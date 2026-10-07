"""Layout-Pruefung im echten Browser (Edge headless, DevTools-Protokoll).

Aufruf:  python tool/viewport.py [BASIS]   (Default http://localhost:8795)

Jede echte Seite (keine Weiterleitung) bei 360 px und 1280 px, je hell und
dunkel: kein Querscrollen, keine Elemente breiter als das Fenster, im
Dunkelmodus dunkler Hintergrund. Ausgabe nur Fehler. Exitcode 1 bei Fehlern.
"""
import asyncio, json, pathlib, subprocess, sys, tempfile, time, urllib.request
import websockets

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8795").rstrip("/")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9333

def pages():
    for f in sorted(ROOT.rglob("*.html")):
        rel = f.relative_to(ROOT)
        if rel.parts[0] in {"docs", "tool", ".git"} or 'http-equiv="refresh"' in f.read_text(encoding="utf-8"):
            continue
        p = "/" + rel.as_posix()
        yield p[: -len("index.html")] if p.endswith("index.html") else p

PROBE = """(() => {
  const vw = document.documentElement.clientWidth;
  // Inhalt eines gewollten Wisch-Karussells (overflow-x auto/scroll) ragt absichtlich hinaus.
  const inScroller = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement)
    if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return true; return false; };
  const wide = [...document.querySelectorAll('body *')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed'
      && !inScroller(e);
  }).slice(0, 3).map(e => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));
  // Text, der ueber seinen Kasten hinauslaeuft (lange Adressen, Woerter)
  const over = [...document.querySelectorAll('body *')].filter(e =>
    e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && getComputedStyle(e).overflowX === 'visible'
    && e.getBoundingClientRect().left + e.scrollWidth > vw + 1)
    .slice(-3).map(e => e.tagName.toLowerCase() + ':' + (e.textContent || '').trim().slice(0, 40));
  wide.push(...over);
  return JSON.stringify({sw: document.documentElement.scrollWidth, vw, wide,
    bg: getComputedStyle(document.body).backgroundColor});
})()"""

async def main():
    tmp = tempfile.mkdtemp()
    edge = subprocess.Popen([EDGE, "--headless=new", f"--remote-debugging-port={PORT}",
                             f"--user-data-dir={tmp}", "--no-first-run", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
                ws_url = next(t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page")
                break
            except Exception:
                time.sleep(0.2)
        errors, n = [], 0
        async with websockets.connect(ws_url, max_size=None) as ws:
            mid = 0
            async def call(method, **params):
                nonlocal mid
                mid += 1
                await ws.send(json.dumps({"id": mid, "method": method, "params": params}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == mid:
                        return msg.get("result", {})
            await call("Page.enable")
            for width in (360, 1280):
                await call("Emulation.setDeviceMetricsOverride", width=width, height=800,
                           deviceScaleFactor=1, mobile=width < 800)
                for scheme in ("light", "dark"):
                    await call("Emulation.setEmulatedMedia",
                               features=[{"name": "prefers-color-scheme", "value": scheme}])
                    for p in pages():
                        await call("Page.navigate", url=BASE + p)
                        await asyncio.sleep(0.6)
                        r = await call("Runtime.evaluate", expression=PROBE, returnByValue=True)
                        d = json.loads(r["result"]["value"])
                        n += 1
                        tag = f"{width}px {scheme:5} {p}"
                        if d["sw"] > d["vw"] or d["wide"]:
                            errors.append(f"Querscrollen {d['sw']}>{d['vw']}  {tag}  {d['wide']}")
                        dark_bg = d["bg"] in ("rgb(33, 26, 21)",)
                        if scheme == "dark" and not dark_bg:
                            errors.append(f"Dunkelmodus greift nicht ({d['bg']})  {tag}")
        print(f"{n} Ansichten geprueft")
        for e in errors:
            print("FEHLER", e)
        print("OK" if not errors else f"{len(errors)} Fehler")
        return 1 if errors else 0
    finally:
        edge.terminate()

sys.exit(asyncio.run(main()))
