#!/bin/sh
# Dienst „import“ des Ausbildungsportals: liest hochgeladene PDFs und eingefügte Texte und macht daraus einen Vorschlag.
# Läuft im eigenen Container ohne Netz; Austausch mit dem Portal nur über den Arbeitsordner (im Portal: data/import):
#   <ARBEIT>/.bereit              Lebenszeichen des Dienstes (wird bei jeder Runde erneuert)
#   <ARBEIT>/<id>/art             was gelesen wird: schulplan oder berichtsheft (schreibt das Portal)
#   <ARBEIT>/<id>/klassen.txt     nur schulplan: die im Portal angelegten Klassen, eine je Zeile (schreibt das Portal)
#   <ARBEIT>/<id>/eingang.pdf     hochgeladene PDF – oder eingang.txt mit eingefügtem Text (schreibt das Portal)
#   <ARBEIT>/<id>/auftrag         Auftrag liegt vor (schreibt das Portal zuletzt)
#   <ARBEIT>/<id>/laeuft          wird gerade gelesen
#   <ARBEIT>/<id>/fortschritt     Prozent (0–100)
#   <ARBEIT>/<id>/text.txt        gelesener Text, Seiten durch Seitenvorschub getrennt (das Portal sucht darin auch selbst nach Mustern)
#   <ARBEIT>/<id>/seite-N.pdf     nur berichtsheft: die einzelnen Seiten der PDF (das Portal hängt sie an die Berichte)
#   <ARBEIT>/<id>/ergebnis.json   Vorschlag des Sprachmodells (prüft das Portal)
#   <ARBEIT>/<id>/fertig          modell=ja|nein, quelle=pdf|texterkennung|text
#   <ARBEIT>/<id>/fehler          kurze Meldung
# Die hochgeladene Datei wird nach dem Lesen immer gelöscht. Immer nur ein Auftrag gleichzeitig.
set -u
ARBEIT="${ARBEIT:-/arbeit}"
PAUSE="${PAUSE:-3}"
SPRACHMODELL="${SPRACHMODELL:-/modelle/sprachmodell.gguf}"
VORLAGEN="${VORLAGEN:-/usr/local/share/import}"
KONTEXT="${KONTEXT:-32768}"
MAX_SEITEN="${MAX_SEITEN:-40}"
MAX_SEITEN_TEXTERKENNUNG="${MAX_SEITEN_TEXTERKENNUNG:-20}"
MAX_ZEICHEN="${MAX_ZEICHEN:-40000}"
THREADS=$(printf "%s" "${THREADS:-2}" | cut -d. -f1)
case "$THREADS" in "" | *[!0-9]* | 0) THREADS=1 ;; esac

fehler() {
	printf '%s\n' "$2" >"$1/fehler"
	rm -f "$1/eingang.pdf" "$1/eingang.txt" "$1/laeuft" "$1/ausgabe.txt" "$1/llama.log" "$1/eingabe.txt"
	rm -f "$1"/seite-*.pdf
	rm -rf "${TMPDIR:-/tmp}/seiten-${1##*/}"
}

fortschritt() {
	echo "$2" >"$1/fortschritt"
}

# Text aus der PDF; ohne genug Text (gescannt) per Texterkennung. Gibt die Quelle aus.
pdf_lesen() {
	d="$1"
	seiten=$(pdfinfo "$d/eingang.pdf" 2>/dev/null | awk '/^Pages:/ { print $2 }')
	case "$seiten" in '' | *[!0-9]*) return 1 ;; esac
	[ "$seiten" -ge 1 ] || return 1
	if [ "$seiten" -gt "$MAX_SEITEN" ]; then
		echo "zu_viele"
		return 0
	fi
	pdftotext -layout -enc UTF-8 -l "$MAX_SEITEN" "$d/eingang.pdf" "$d/text.txt" 2>/dev/null || return 1
	zeichen=$(tr -d '[:space:]' <"$d/text.txt" | wc -c)
	# weniger als 40 Zeichen je Seite: vermutlich ein Scan – dann Texterkennung (oder immer, mit TEXTERKENNUNG=1)
	if [ "${TEXTERKENNUNG:-}" = 1 ] || [ "$zeichen" -lt $((seiten * 40)) ]; then
		tmp="${TMPDIR:-/tmp}/seiten-${d##*/}"
		rm -rf "$tmp" && mkdir -p "$tmp"
		n=$seiten
		[ "$n" -gt "$MAX_SEITEN_TEXTERKENNUNG" ] && n=$MAX_SEITEN_TEXTERKENNUNG
		pdftoppm -r 300 -gray -png -l "$n" "$d/eingang.pdf" "$tmp/seite" 2>/dev/null || { rm -rf "$tmp"; return 1; }
		: >"$d/text.txt"
		i=0
		for bild in "$tmp"/seite*.png; do
			[ -f "$bild" ] || continue
			i=$((i + 1))
			fortschritt "$d" $((10 + 40 * i / n))
			# Seiten wie bei pdftotext durch einen Seitenvorschub trennen
			[ "$i" -gt 1 ] && printf '\f' >>"$d/text.txt"
			tesseract "$bild" stdout -l deu --psm 6 2>/dev/null >>"$d/text.txt"
		done
		rm -rf "$tmp"
		echo "texterkennung"
		return 0
	fi
	echo "pdf"
}

vorschlag() {
	d="$1"
	art="$2"
	[ -f "$SPRACHMODELL" ] && command -v llama-completion >/dev/null 2>&1 || return 1
	[ -f "$VORLAGEN/$art/system.txt" ] && [ -f "$VORLAGEN/$art/schema.json" ] || return 1
	: >"$d/eingabe.txt"
	# Schulplan: die im Portal angelegten Klassen stehen vor dem Text – nur ihnen soll das Modell Zeiträume zuordnen
	if [ -s "$d/klassen.txt" ]; then
		printf 'Angelegte Klassen: %s\n\n' "$(head -c 2000 "$d/klassen.txt" | tr '\n' ',' | sed -e 's/,$//' -e 's/,/, /g')" >>"$d/eingabe.txt"
	fi
	head -c "$MAX_ZEICHEN" "$d/text.txt" >>"$d/eingabe.txt"
	llama-completion -m "$SPRACHMODELL" --jinja -rea off -st --no-display-prompt --no-warmup \
		-c "$KONTEXT" -n 6000 -t "$THREADS" --temp 0.1 --top-p 0.9 \
		-sysf "$VORLAGEN/$art/system.txt" --json-schema-file "$VORLAGEN/$art/schema.json" \
		-f "$d/eingabe.txt" </dev/null >"$d/ausgabe.txt" 2>"$d/llama.log"
	ok=$?
	rm -f "$d/eingabe.txt" "$d/llama.log"
	if [ "$ok" -ne 0 ] || ! grep -q '{' "$d/ausgabe.txt" 2>/dev/null; then
		rm -f "$d/ausgabe.txt"
		return 1
	fi
	# Nur das JSON-Objekt behalten; das Portal prüft den Inhalt
	tr '\n' ' ' <"$d/ausgabe.txt" | sed -e 's/^[^{]*//' -e 's/}[^}]*$/}/' >"$d/ergebnis.tmp"
	mv "$d/ergebnis.tmp" "$d/ergebnis.json"
	rm -f "$d/ausgabe.txt"
}

lesen() {
	d="$1"
	: >"$d/laeuft"
	fortschritt "$d" 5
	art=$(head -c 40 "$d/art" 2>/dev/null | tr -cd 'a-z')
	case "$art" in schulplan | berichtsheft) ;; *) fehler "$d" 'Unbekannte Art des Auftrags.'; return ;; esac
	if [ -f "$d/eingang.pdf" ]; then
		quelle=$(pdf_lesen "$d") || { fehler "$d" 'Die PDF lässt sich nicht lesen.'; return; }
		[ "$quelle" = zu_viele ] && { fehler "$d" "Die PDF hat mehr als $MAX_SEITEN Seiten."; return; }
		# alte Berichte: die Seiten einzeln ablegen – das Portal hängt jeder Woche ihre Originalseite an
		if [ "$art" = berichtsheft ]; then
			pdfseparate "$d/eingang.pdf" "$d/seite-%d.pdf" 2>/dev/null || rm -f "$d"/seite-*.pdf
		fi
	elif [ -f "$d/eingang.txt" ]; then
		cp "$d/eingang.txt" "$d/text.txt"
		quelle=text
	else
		fehler "$d" 'Es fehlt die Datei oder der Text.'
		return
	fi
	rm -f "$d/eingang.pdf" "$d/eingang.txt"
	if [ "$(tr -d '[:space:]' <"$d/text.txt" | wc -c)" -lt 10 ]; then
		fehler "$d" 'Darin steht kein lesbarer Text.'
		return
	fi
	fortschritt "$d" 55
	modell=nein
	vorschlag "$d" "$art" && modell=ja
	printf 'modell=%s\nquelle=%s\n' "$modell" "$quelle" >"$d/fertig"
	rm -f "$d/laeuft" "$d/fortschritt"
}

# Darf der Dienst nicht in den Arbeitsordner schreiben (meist: Docker hat data/import als root angelegt),
# sagt er es deutlich und wartet – nach dem chown geht es ohne Neustart weiter.
until : >"$ARBEIT/.bereit" 2>/dev/null; do
	echo "FEHLER: In $ARBEIT darf der Dienst nicht schreiben. Auf dem Server im Ordner des Portals: sudo chown -R 1000:1000 data/import – der Dienst versucht es jede Minute neu."
	sleep 60
done
echo "Dienst import bereit, Arbeitsordner $ARBEIT"
while :; do
	: >"$ARBEIT/.bereit" 2>/dev/null
	for d in "$ARBEIT"/*/; do
		d=${d%/}
		[ -f "$d/auftrag" ] || continue
		[ -e "$d/fertig" ] || [ -e "$d/fehler" ] && continue
		# Abgebrochener Lauf (Neustart): neu beginnen, sofern die Eingabe noch da ist
		lesen "$d"
		break
	done
	[ "${EINMAL:-}" = 1 ] && exit 0
	sleep "$PAUSE"
done
