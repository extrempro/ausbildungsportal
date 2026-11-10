"""Legt für jede Version aus CHANGELOG.md ein GitHub-Release mit Tag vX.Y.Z an, falls es noch fehlt.

Der Tag zeigt auf den Commit „Version X.Y.Z …“. Bereits vorhandene Releases bleiben unverändert.
Aufruf in GitHub Actions (GH_TOKEN gesetzt); mit TROCKEN=1 wird nur angezeigt, was passieren würde.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

TROCKEN = os.environ.get("TROCKEN") == "1"


def lauf(*befehl, pruefen=True):
    return subprocess.run(befehl, capture_output=True, text=True, check=pruefen)


def versionen():
    text = open("CHANGELOG.md", encoding="utf-8").read()
    teile = re.split(r"^## \[(\d+\.\d+\.\d+)\] – (\S+)[ \t]*\n", text, flags=re.M)
    for i in range(1, len(teile), 3):
        yield teile[i], teile[i + 1], teile[i + 2].strip()


def commit_fuer(version):
    muster = "^Version " + re.escape(version) + "($|[^0-9.])"
    r = lauf("git", "log", "--format=%H", "-E", f"--grep={muster}", "HEAD")
    treffer = r.stdout.split()
    return treffer[-1] if treffer else None  # ältester Treffer = der eigentliche Versions-Commit


def schluessel(v):
    return [int(x) for x in v.split(".")]


def main():
    liste = sorted(versionen(), key=lambda x: schluessel(x[0]))
    if not liste:
        sys.exit("Keine Versionen in CHANGELOG.md gefunden")
    paket = json.load(open("package.json", encoding="utf-8"))["version"]
    neueste = liste[-1][0]
    if TROCKEN:
        vorhanden = set()
    else:
        r = lauf("gh", "release", "list", "--limit", "1000", "--json", "tagName")
        vorhanden = {x["tagName"] for x in json.loads(r.stdout or "[]")}

    angelegt = 0
    for version, datum, notizen in liste:
        tag = f"v{version}"
        if tag in vorhanden:
            continue
        sha = commit_fuer(version) or (lauf("git", "rev-parse", "HEAD").stdout.strip() if version == paket else None)
        if not sha:
            print(f"::warning::Kein Commit „Version {version}“ gefunden – Release {tag} übersprungen")
            continue
        text = f"Veröffentlicht am {datum}.\n\n{notizen}\n"
        if TROCKEN:
            print(f"[trocken] {tag} → {sha[:7]} (latest={version == neueste})\n{text}")
            angelegt += 1
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
            f.write(text)
        lauf(
            "gh", "release", "create", tag,
            "--target", sha,
            "--title", f"Version {version}",
            "--notes-file", f.name,
            f"--latest={'true' if version == neueste else 'false'}",
        )
        print(f"Release {tag} angelegt ({sha[:7]})")
        angelegt += 1
    print(f"{angelegt} Release(s) angelegt, {len(vorhanden)} waren schon vorhanden.")


if __name__ == "__main__":
    main()
