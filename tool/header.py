"""Kopfzeile + hreflang auf allen Seiten einheitlich setzen (idempotent).

Aufruf: python tool/header.py   (aus beliebigem Verzeichnis)
Zuordnung DE <-> EN steht in PAGES; fehlt eine Uebersetzung, zeigt der
Sprachschalter auf die englische Seite der App, hreflang entfaellt dann.
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://remindery.de"

# Pfad der deutschen Seite -> (Gegenstueck EN, echtes Paar?)
PAIRS = {
    "/": ("/en/", True),
    "/about/": ("/en/about/", True),
    "/privacy/": ("/en/privacy/", True),
    "/legal-notice/": ("/en/legal-notice/", True),
    "/ox/": ("/en/ox/", True),
    "/ox/privacy/": ("/en/ox/", False),
    "/ox/terms/": ("/en/ox/", False),
    "/syllables/": ("/en/syllables/", True),
    "/syllables/privacy/": ("/en/syllables/", False),
    "/clock/": ("/en/clock/", True),
    "/clock/privacy/": ("/en/clock/", False),
    "/birthdays/": ("/en/birthdays/", True),
    "/birthdays/privacy/": ("/en/birthdays/privacy/", True),
}

def page(url):
    return ROOT / url.strip("/") / "index.html" if url != "/" else ROOT / "index.html"

def header(lang, de, en, pair, current):
    if lang == "de":
        home, about, label, nav, lang_label = "/", "/about/", "Über uns", "Hauptnavigation", "Sprache"
    else:
        home, about, label, nav, lang_label = "/en/", "/en/about/", "About", "Main navigation", "Language"
    cur = lambda k: ' aria-current="page"' if current == k else ""
    de_cur = ' aria-current="true"' if lang == "de" else ""
    en_cur = ' aria-current="true"' if lang == "en" else ""
    en_title = "English" if pair else "English – diese Seite gibt es nur auf Deutsch"
    return f"""  <header class="site-head">
    <div class="head-in">
      <a class="site-brand" href="{home}"><img src="/favicon.svg" width="34" height="34" alt=""><span>Remindery Apps</span></a>
      <nav class="site-nav" aria-label="{nav}">
        <a href="{home}#apps"{cur('apps')}>Apps</a>
        <a href="{about}"{cur('about')}>{label}</a>
        <span class="lang" role="group" aria-label="{lang_label}"><a href="{de}" hreflang="de" lang="de" title="Deutsch"{de_cur}>DE</a><a href="{en}" hreflang="en" lang="en" title="{en_title}"{en_cur}>EN</a></span>
      </nav>
    </div>
  </header>
"""

def patch(url, lang, de, en, pair):
    f = page(url)
    s = f.read_text(encoding="utf-8")
    current = {"/": "apps", "/en/": "apps", "/about/": "about", "/en/about/": "about"}.get(url)
    # alte Koepfe entfernen
    s = re.sub(r"\n?  <header class=\"site-head\">.*?</header>\n", "\n", s, flags=re.S)
    s = re.sub(r"\s*<header class=\"top\">.*?</header>\n", "\n", s, flags=re.S)
    s = re.sub(r"\s*<header class=\"page-header\">(?:(?!</header>).)*?<a href=\"/\">Remindery Apps</a>.*?</header>\n",
               "\n", s, flags=re.S)
    s = re.sub(r"\n\s*<span class=\"lang-switch\"[^\n]*</span>", "", s)
    s = re.sub(r"<body([^>]*)>\n+", lambda m: f"<body{m.group(1)}>\n" + header(lang, de, en, pair, current), s, count=1)
    # hreflang
    s = re.sub(r"  <link rel=\"alternate\" hreflang=[^\n]*\n", "", s)
    if pair:
        alt = (f'  <link rel="alternate" hreflang="de" href="{SITE}{de}">\n'
               f'  <link rel="alternate" hreflang="en" href="{SITE}{en}">\n'
               f'  <link rel="alternate" hreflang="x-default" href="{SITE}{de}">\n')
        s = s.replace('  <link rel="icon"', alt + '  <link rel="icon"', 1)
    if lang == "en":
        s = s.replace('<a href="/">All apps</a>', '<a href="/en/">All apps</a>')
    f.write_text(s, encoding="utf-8")

done = set()
for de, (en, pair) in PAIRS.items():
    patch(de, "de", de, en, pair); done.add(de)
    if pair:
        patch(en, "en", de, en, pair); done.add(en)
print(len(done), "Seiten")
