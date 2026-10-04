"""Crawl der Website: alle internen Links und Ressourcen muessen 200 liefern.

Aufruf:  python tool/crawl.py [BASIS]     (Default http://localhost:8795)
         python tool/crawl.py https://remindery.de

Startet bei / und /en/ sowie bei jeder HTML-Datei im Repo (auch Waisen und
Weiterleitungen), folgt allen internen href/src, prueft Sprungziele (#id),
hreflang-Gegenseitigkeit und dass jede Seite genau einen Sprachschalter hat.
Ausgabe: nur Fehler plus eine Zusammenfassung. Exitcode 1 bei Fehlern.
"""
import pathlib, re, sys, urllib.error, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8795").rstrip("/")
SKIP_DIRS = {"docs", "tool", ".git"}

def repo_pages():
    for f in ROOT.rglob("*.html"):
        rel = f.relative_to(ROOT)
        if rel.parts[0] in SKIP_DIRS:
            continue
        p = "/" + rel.as_posix()
        yield p[: -len("index.html")] if p.endswith("index.html") else p

def fetch(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "remindery-crawl"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            ctype = r.headers.get("Content-Type", "")
            body = r.read().decode("utf-8", "replace") if "html" in ctype else ""
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # Zeitueberschreitung, DNS ...
        return f"ERR {e.__class__.__name__}", ""

errors, pages, ids, alternates, status = [], {}, {}, {}, {}
queue = ["/", "/en/", *sorted(repo_pages())]
seen = set()
while queue:
    path = queue.pop(0)
    if path in seen:
        continue
    seen.add(path)
    code, body = fetch(path)
    status[path] = code
    if code != 200:
        continue
    if not body:
        continue
    pages[path] = body
    ids[path] = set(re.findall(r'\sid="([^"]+)"', body))
    refresh = re.search(r'http-equiv="refresh" content="\d+;\s*url=([^"]+)"', body, re.I)
    links = re.findall(r'(?:href|src)="([^"]+)"', body)
    if refresh:
        links.append(refresh.group(1))
    alternates[path] = dict(re.findall(r'rel="alternate" hreflang="([^"]+)" href="https://remindery\.de([^"]+)"', body))
    for link in links:
        u = urllib.parse.urlparse(urllib.parse.urljoin(BASE + path, link))
        if u.scheme not in ("http", "https") or u.netloc != urllib.parse.urlparse(BASE).netloc:
            continue
        target = u.path or "/"
        if u.fragment:
            ids.setdefault(("#", target, u.fragment, path), None)
        if target not in seen:
            queue.append(target)

for path, code in status.items():
    if code != 200:
        errors.append(f"{code}  {path}")

for key in [k for k in ids if isinstance(k, tuple)]:
    _, target, frag, src = key
    if target in pages and frag not in ids.get(target, set()):
        errors.append(f"Sprungziel fehlt  {target}#{frag}  (verlinkt von {src})")

for path, body in pages.items():
    if 'http-equiv="refresh"' in body:
        continue
    n = body.count('class="site-head"')
    if n != 1:
        errors.append(f"Kopfzeile {n}x  {path}")
    sw = re.search(r'<span class="lang"[^>]*><a href="([^"]+)"[^>]*>DE</a><a href="([^"]+)"', body)
    if not sw:
        errors.append(f"Sprachschalter fehlt  {path}")
    elif path not in sw.groups():
        errors.append(f"Sprachschalter enthaelt die Seite selbst nicht  {path}  {sw.groups()}")
    alt = alternates.get(path, {})
    for lang, other in alt.items():
        if lang == "x-default":
            continue
        back = alternates.get(other, {})
        if path not in back.values():
            errors.append(f"hreflang nicht gegenseitig  {path} -> {other}")

html = [p for p, b in pages.items() if 'http-equiv="refresh"' not in b]
print(f"{BASE}: {len(status)} Adressen, {len(html)} Seiten, {len(pages) - len(html)} Weiterleitungen")
for e in errors:
    print("FEHLER", e)
print("OK" if not errors else f"{len(errors)} Fehler")
sys.exit(1 if errors else 0)
