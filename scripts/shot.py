#!/usr/bin/env python3
"""Capture one ShadyNotes window by CGWindowID.

Captures the WINDOW, not a screen region, so overlapping notification
banners are excluded by construction rather than by luck. Verified: a
Messenger banner landed in a region capture during the 007 docs pass.
"""
import subprocess, sys, os
import Quartz

def windows():
    opts = (Quartz.kCGWindowListOptionOnScreenOnly
            | Quartz.kCGWindowListExcludeDesktopElements)
    out = []
    for w in Quartz.CGWindowListCopyWindowInfo(opts, Quartz.kCGNullWindowID):
        if "Shady" in (w.get("kCGWindowOwnerName") or ""):
            b = w["kCGWindowBounds"]
            out.append({
                "id": w["kCGWindowNumber"],
                "x": int(b["X"]), "y": int(b["Y"]),
                "w": int(b["Width"]), "h": int(b["Height"]),
            })
    return out

def shade():
    """The shade, identified structurally — not by being the biggest window.

    It is anchored under the menu bar (y <= 40) and is wide. Sticky notes are
    340x300 and float anywhere; picking "largest" once grabbed a personal
    sticky note when the shade was closed. Never guess here.
    """
    ws = [w for w in windows()
          if w["y"] <= 40 and w["w"] >= 600 and w["h"] >= 400]
    return max(ws, key=lambda w: w["w"] * w["h"]) if ws else None

def capture(dest, wid=None):
    w = None
    if wid is None:
        w = shade()
        if not w:
            print("no shade window on screen", file=sys.stderr); return 2
        wid = w["id"]
    subprocess.run(["screencapture", "-x", "-o", f"-l{wid}", dest], check=True)
    if w:
        print(f"  {os.path.basename(dest)}  {w['w']}x{w['h']} (win {wid})")
    return 0

if __name__ == "__main__":
    if sys.argv[1] == "list":
        for w in windows(): print(w)
    else:
        sys.exit(capture(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else None))

def composite(dest, panel_id):
    """Capture the shade and an overlay panel separately, then composite.

    Panels (slash menu, theme picker) are their own CGWindows, so a shade-only
    capture misses them and a region capture would readmit notification
    banners. Capturing both windows and pasting at the real offset keeps the
    window-scoped safety while showing the panel in context.
    """
    from PIL import Image
    import tempfile
    sh = shade()
    p = next(w for w in windows() if w["id"] == panel_id)
    with tempfile.TemporaryDirectory() as td:
        a, b = f"{td}/s.png", f"{td}/p.png"
        subprocess.run(["screencapture","-x","-o",f"-l{sh['id']}",a], check=True)
        subprocess.run(["screencapture","-x","-o",f"-l{panel_id}",b], check=True)
        base, over = Image.open(a).convert("RGBA"), Image.open(b).convert("RGBA")
        sx = base.width / sh["w"]          # Retina factor, if any
        off = (int((p["x"]-sh["x"])*sx), int((p["y"]-sh["y"])*sx))
        base.alpha_composite(over, off)
        base.convert("RGB").save(dest)
    print(f"  {os.path.basename(dest)}  {base.size} (shade {sh['id']} + panel {panel_id})")
