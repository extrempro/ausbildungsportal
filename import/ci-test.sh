#!/usr/bin/env bash
# Prüft das Abbild des Dienstes „import“ im CI: ohne Netz, schreibgeschützt, als Benutzer 1000.
# Liest einen erfundenen Blockplan und erfundene alte Berichte – je als digitale PDF und als Scan (Texterkennung) –
# und prüft den Vorschlag des Sprachmodells.
#   bash import/ci-test.sh   (baut ghcr.io/extrempro/ausbildungsportal-import:latest)
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=ghcr.io/extrempro/ausbildungsportal-import:latest
fehler() {
	echo "FEHLER: $1" >&2
	exit 1
}

docker build --quiet -t "$IMAGE" import >/dev/null
ARBEIT=$(mktemp -d)
trap 'docker run --rm -v "$ARBEIT:/a" --entrypoint sh "$IMAGE" -c "rm -rf /a/* /a/.bereit" >/dev/null 2>&1; rm -rf "$ARBEIT"' EXIT
chmod 777 "$ARBEIT"

lies() {
	local id=$1 datei=$2 art=${3:-schulplan}
	mkdir -m 777 "$ARBEIT/$id"
	cp "import/test/$datei" "$ARBEIT/$id/eingang.pdf"
	echo "$art" >"$ARBEIT/$id/art"
	: >"$ARBEIT/$id/auftrag"
	chmod 666 "$ARBEIT/$id"/*
	docker run --rm --network none --read-only --tmpfs /tmp --cap-drop ALL \
		--security-opt no-new-privileges --memory 8g -e EINMAL=1 -e THREADS=2 -v "$ARBEIT:/arbeit" "$IMAGE"
	[ -f "$ARBEIT/$id/fehler" ] && fehler "$datei: $(cat "$ARBEIT/$id/fehler")"
	[ -f "$ARBEIT/$id/fertig" ] || fehler "$datei: keine Datei fertig"
	[ -e "$ARBEIT/$id/eingang.pdf" ] && fehler "$datei: hochgeladene Datei nicht gelöscht"
	grep -q 'modell=ja' "$ARBEIT/$id/fertig" || fehler "$datei: kein Vorschlag des Sprachmodells: $(cat "$ARBEIT/$id/fertig")"
	if [ "$art" = berichtsheft ]; then
		grep -q 'Netzwerkkabel' "$ARBEIT/$id/text.txt" || fehler "$datei: Text nicht gelesen"
		[ "$(tr -cd '\f' <"$ARBEIT/$id/text.txt" | wc -c)" -ge 1 ] || fehler "$datei: Seiten nicht getrennt"
		[ -f "$ARBEIT/$id/seite-1.pdf" ] && [ -f "$ARBEIT/$id/seite-2.pdf" ] || fehler "$datei: Seiten nicht einzeln abgelegt"
		python3 - "$ARBEIT/$id/ergebnis.json" <<'PY' || fehler "$datei: Vorschlag passt nicht"
import json, sys
w = json.load(open(sys.argv[1]))["wochen"]
print(json.dumps(w, ensure_ascii=False))
assert any(x["von"] == "2026-09-07" and x["betrieb"] for x in w), "Woche vom 07.09.2026 fehlt"
assert not any("Muster" in e["text"] for x in w for t in ("betrieb", "unterweisung", "schule") for e in x[t]), "Name im Vorschlag"
PY
		echo "OK: $datei ($(grep quelle "$ARBEIT/$id/fertig"))"
		return
	fi
	grep -q '31.08' "$ARBEIT/$id/text.txt" || fehler "$datei: Text nicht gelesen"
	python3 - "$ARBEIT/$id/ergebnis.json" <<'PY' || fehler "$datei: Vorschlag passt nicht"
import json, sys
b = json.load(open(sys.argv[1]))["bloecke"]
print(json.dumps(b, ensure_ascii=False))
assert any(x["von"] == "2026-08-31" and "25" in x["klasse"] and "a" in x["klasse"].lower() for x in b), "Block 1 der FI 25a fehlt"
assert not any(x["von"] == "2026-10-12" for x in b), "Herbstferien als Schulblock"
PY
	echo "OK: $datei ($(grep quelle "$ARBEIT/$id/fertig"))"
}

echo "== digitale PDF"
lies aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa plan.pdf
grep -q 'quelle=pdf' "$ARBEIT/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/fertig" || fehler "digitale PDF nicht als Text gelesen"
echo "== gescannte PDF (Texterkennung)"
lies bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb scan.pdf
grep -q 'quelle=texterkennung' "$ARBEIT/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/fertig" || fehler "Scan nicht per Texterkennung gelesen"
echo "== alte Berichte, digitale PDF"
lies cccccccccccccccccccccccccccccccc berichte.pdf berichtsheft
echo "== alte Berichte, gescannt (Texterkennung)"
lies dddddddddddddddddddddddddddddddd berichte-scan.pdf berichtsheft
grep -q 'quelle=texterkennung' "$ARBEIT/dddddddddddddddddddddddddddddddd/fertig" || fehler "Scan der Berichte nicht per Texterkennung gelesen"
[ -f "$ARBEIT/.bereit" ] || fehler "kein Lebenszeichen .bereit"
echo "OK: Dienst import"
