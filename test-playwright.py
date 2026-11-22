"""Playtest Gilded Shadow in headless Chromium: console-error check,
scripted play, and the 4 entry screenshots."""
import json
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080"
OUT = "/home/hatch/workspace/wl-agent/makefun/heist-v2/screenshots"

errors = []


def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        # 1. Briefing screen (default load).
        page.goto(BASE + "/", wait_until="networkidle")
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/3-briefing.jpg", type="jpeg", quality=82)

        # 2. Buy a smoke bomb + intel, then start the heist.
        # Canvas is 1024x640 centered in the 1280x800 viewport: offset (+128, +66).
        page.mouse.click(942, 345)  # smoke +
        page.wait_for_timeout(150)
        page.mouse.click(942, 495)  # intel +
        page.wait_for_timeout(150)
        page.mouse.click(640, 614)  # START HEIST
        page.wait_for_timeout(800)

        # 3. Scripted play: move around, sneak, throw a coin, use smoke.
        page.keyboard.down("w")
        page.wait_for_timeout(1200)
        page.keyboard.up("w")
        page.keyboard.down("d")
        page.wait_for_timeout(900)
        page.keyboard.up("d")
        page.keyboard.down("Shift")
        page.keyboard.down("a")
        page.wait_for_timeout(900)
        page.keyboard.up("a")
        page.keyboard.up("Shift")
        page.mouse.click(700, 400)  # throw coin (no coins bought -> no-op, must not crash)
        page.keyboard.press("q")  # smoke bomb
        page.wait_for_timeout(500)
        page.keyboard.press("e")  # interact (nothing near -> no-op)
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/2-playtest.jpg", type="jpeg", quality=82)

        # 4. Staged shots.
        page.goto(BASE + "/?shot=1", wait_until="networkidle")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{OUT}/1-cover.jpg", type="jpeg", quality=82)

        page.goto(BASE + "/?shot=2", wait_until="networkidle")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{OUT}/4-getaway.jpg", type="jpeg", quality=82)

        page.goto(BASE + "/?shot=4", wait_until="networkidle")
        page.wait_for_timeout(800)
        page.screenshot(path=f"{OUT}/5-caught.jpg", type="jpeg", quality=82)

        browser.close()

    print("ERRORS:" if errors else "NO ERRORS")
    for e in errors:
        print(" -", e)


if __name__ == "__main__":
    run()
