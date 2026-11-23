/* global microsoftTeams */
/**
 * Einstieg der Teams-App (/teams/app): in Teams über das Microsoft-Konto anmelden (Single Sign-on) und das Ziel im Portal öffnen.
 * Läuft unverändert im Reiter, ohne Build. Die Bibliothek von Microsoft liegt unter /teams/teams.js (vom eigenen Server).
 * - Ziel: ?ziel=… oder subPageId aus dem Link der Meldung; nur eigene Pfade (wie sicheresZiel in server/teams.ts)
 * - Vorsatz „hinweis:“: Aufruf aus dem Aktivitätsfeed – dort nur ein Hinweis mit „In der App öffnen“
 * - außerhalb von Teams: nach 5 Sekunden direkt zum Ziel
 */
(function () {
  'use strict';
  var HINWEIS = 'hinweis:';
  var REITER = 'portal'; // entityId im Manifest (REITER in server/teams.ts)
  var status = document.getElementById('status');
  var hinweisBox = document.getElementById('hinweis');
  var fehlerBox = document.getElementById('fehler');
  var fehlerText = document.getElementById('fehlertext');
  var erneut = document.getElementById('erneut');
  var params = new URLSearchParams(location.search);

  function sicher(ziel) {
    return typeof ziel === 'string' && /^\/[a-z0-9/-]{0,100}$/.test(ziel) && ziel.indexOf('//') === -1 ? ziel : '/';
  }
  function zeige(el, an) {
    el.className = an ? '' : 'aus';
  }
  function fehler(text) {
    zeige(status, false);
    zeige(fehlerBox, true);
    fehlerText.textContent = text;
  }

  function anmelden(ziel) {
    zeige(status, true);
    zeige(fehlerBox, false);
    status.textContent = 'Anmeldung läuft …';
    microsoftTeams.authentication
      .getAuthToken()
      .then(function (token) {
        return fetch('/api/auth/teams', { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + token } });
      })
      .then(function (r) {
        if (r.ok) return location.replace(ziel);
        return r.json().then(
          function (j) {
            fehler(j.fehler || 'Die Anmeldung hat nicht geklappt.');
          },
          function () {
            fehler('Die Anmeldung hat nicht geklappt.');
          },
        );
      })
      .catch(function () {
        fehler('Teams konnte dich nicht anmelden. Versuch es noch einmal oder öffne das Portal im Browser.');
      });
  }

  function hinweis(ziel, ctx) {
    zeige(status, false);
    zeige(hinweisBox, true);
    document.getElementById('zurapp').addEventListener('click', function () {
      var pages = microsoftTeams.pages;
      var weiter =
        pages.currentApp && pages.currentApp.isSupported()
          ? pages.currentApp.navigateTo({ pageId: REITER, subPageId: ziel })
          : pages.navigateToApp({ appId: String(ctx.app.appId), pageId: REITER, subPageId: ziel });
      Promise.resolve(weiter).catch(function () {
        fehler('Teams konnte nicht in die App wechseln. Öffne links in Teams die App „Ausbildungsportal“ oder das Portal im Browser.');
        zeige(erneut, false);
      });
    });
  }

  function start() {
    var roh = params.get('ziel') || '';
    var ausFeed = roh.indexOf(HINWEIS) === 0;
    if (ausFeed) roh = roh.slice(HINWEIS.length);
    var ziel = sicher(roh || '/');
    var bereit = new Promise(function (_, nein) {
      setTimeout(function () {
        nein(new Error('ausserhalb'));
      }, 5000);
    });
    Promise.race([microsoftTeams.app.initialize(), bereit])
      .then(function () {
        return microsoftTeams.app.getContext().catch(function () {
          return null;
        });
      })
      .then(
        function (ctx) {
          var sub = ctx && ctx.page && ctx.page.subPageId;
          if (sub && sub.indexOf(HINWEIS) === 0) {
            ausFeed = true;
            sub = sub.slice(HINWEIS.length);
          }
          if (ziel === '/' && sub) ziel = sicher(sub);
          try {
            microsoftTeams.app.notifySuccess();
          } catch (e) {
            /* egal */
          }
          if (ausFeed && ctx) return hinweis(ziel, ctx);
          erneut.addEventListener('click', function () {
            anmelden(ziel);
          });
          if (params.has('abgemeldet')) return;
          anmelden(ziel);
        },
        function () {
          // außerhalb von Teams: einfach weiter ins Portal
          location.replace(ziel);
        },
      );
  }

  start();
})();
