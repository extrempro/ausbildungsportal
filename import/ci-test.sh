#!/usr/bin/env bash
# Prüft das Abbild des Dienstes „import“ im CI: ohne Netz, schreibgeschützt, als Benutzer 1000.
# Liest einen erfundenen Blockplan als digitale PDF und als Scan (Texterkennung) und prüft den Vorschlag des Sprachmodells.
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
	local id=$1 datei=$2
	mkdir -m 777 "$ARBEIT/$id"
	cp "import/test/$datei" "$ARBEIT/$id/eingang.pdf"
	echo schulplan >"$ARBEIT/$id/art"
	: >"$ARBEIT/$id/auftrag"
	chmod 666 "$ARBEIT/$id"/*
	docker run --rm --network none --read-only --tmpfs /tmp --cap-drop ALL \
		--security-opt no-new-privileges --memory 8g -e EINMAL=1 -e THREADS=2 -v "$ARBEIT:/arbeit" "$IMAGE"
	[ -f "$ARBEIT/$id/fehler" ] && fehler "$datei: $(cat "$ARBEIT/$id/fehler")"
	[ -f "$ARBEIT/$id/fertig" ] || fehler "$datei: keine Datei fertig"
	[ -e "$ARBEIT/$id/eingang.pdf" ] && fehler "$datei: hochgeladene Datei nicht gelöscht"
	grep -q '31.08' "$ARBEIT/$id/text.txt" || fehler "$datei: Text nicht gelesen"
	grep -q 'modell=ja' "$ARBEIT/$id/fertig" || fehler "$datei: kein Vorschlag des Sprachmodells: $(cat "$ARBEIT/$id/fertig")"
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
[ -f "$ARBEIT/.bereit" ] || fehler "kein Lebenszeichen .bereit"
echo "OK: Dienst import"
