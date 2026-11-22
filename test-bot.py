"""End-to-end bot playthrough of level 1: spawn -> diamond -> exit.
Steers around guard vision cones, presses E to interact, and reports
whether the level completes (proves the level is winnable)."""
import math
import time

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080"
KEYS = {"up": "w", "down": "s", "left": "a", "right": "d"}


def angle_diff(a, b):
    d = a - b
    while d > math.pi:
        d -= 2 * math.pi
    while d < -math.pi:
        d += 2 * math.pi
    return d


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda e: print("PAGEERROR:", e))
        page.goto(BASE + "/", wait_until="networkidle")
        page.wait_for_timeout(800)
        page.mouse.click(640, 614)  # START HEIST
        page.wait_for_timeout(500)

        held = set()

        def set_keys(want):
            for k in list(held):
                if k not in want:
                    page.keyboard.up(KEYS[k])
                    held.discard(k)
            for k in want:
                if k not in held:
                    page.keyboard.down(KEYS[k])
                    held.add(k)

        def steer(snap, tx, ty):
            """Return a set of movement keys toward (tx,ty), dodging cones."""
            px, py = snap["player"]["x"], snap["player"]["y"]
            dx, dy = tx - px, ty - py
            dist = math.hypot(dx, dy)
            if dist < 6:
                return set()
            mx, my = dx / dist, dy / dist
            # Flee any guard whose cone covers us or who is close and alert.
            for g in snap["guards"]:
                gd = math.hypot(px - g["x"], py - g["y"])
                if gd > 200:
                    continue
                ang = math.atan2(py - g["y"], px - g["x"])
                in_cone = abs(angle_diff(ang, g["facing"])) < 1.05 and gd < 185
                if in_cone or g["state"] in ("chase", "suspicious") or gd < 90:
                    # Run away from the guard, biased toward the target.
                    fx, fy = (px - g["x"]) / max(gd, 1), (py - g["y"]) / max(gd, 1)
                    mx, my = fx * 0.8 + mx * 0.2, fy * 0.8 + my * 0.2
                    n = math.hypot(mx, my) or 1
                    mx, my = mx / n, my / n
                    break
            keys = set()
            if my < -0.35:
                keys.add("up")
            if my > 0.35:
                keys.add("down")
            if mx < -0.35:
                keys.add("left")
            if mx > 0.35:
                keys.add("right")
            return keys

        start = time.time()
        timeout = 150
        last_report = 0
        last_pos = None
        last_move_time = time.time()
        detour_until = 0
        detour_side = 1
        detour_dir = (0, 0)
        result = "TIMEOUT"
        while time.time() - start < timeout:
            snap = page.evaluate("window.__heist.snapshot()")
            if snap is None:
                time.sleep(0.2)
                continue
            phase = snap["phase"]
            if phase == "levelComplete":
                result = "LEVEL COMPLETE"
                break
            if phase == "caught":
                result = f"CAUGHT (alarm {snap['alarm']}%, elapsed {snap['elapsed']}s)"
                break
            if phase != "playing":
                time.sleep(0.2)
                continue
            px, py = snap["player"]["x"], snap["player"]["y"]
            target = snap["exit"] if snap["player"]["hasDiamond"] else snap["diamond"]
            dist = math.hypot(target["x"] - px, target["y"] - py)

            # Stuck detection: barely moved in 1.5s while trying -> detour around the obstacle.
            now = time.time()
            if last_pos is None:
                last_pos = (px, py)
                last_move_time = now
            elif math.hypot(px - last_pos[0], py - last_pos[1]) > 6:
                last_pos = (px, py)
                last_move_time = now
            if now - last_move_time > 1.5 and now > detour_until:
                detour_side *= -1
                dx, dy = target["x"] - px, target["y"] - py
                n = math.hypot(dx, dy) or 1
                detour_dir = (-dy / n * detour_side, dx / n * detour_side)
                detour_until = now + 1.4
                last_move_time = now
                last_pos = (px, py)
                print(f"  stuck at ({px},{py}) -> detour {detour_dir}")

            if dist < 30:
                set_keys(set())
                page.keyboard.press("e")
                time.sleep(0.25)
            elif now < detour_until:
                keys = set()
                if detour_dir[1] < -0.3:
                    keys.add("up")
                if detour_dir[1] > 0.3:
                    keys.add("down")
                if detour_dir[0] < -0.3:
                    keys.add("left")
                if detour_dir[0] > 0.3:
                    keys.add("right")
                set_keys(keys)
            else:
                set_keys(steer(snap, target["x"], target["y"]))
            now = time.time()
            if now - last_report > 10:
                last_report = now
                print(f"  t={snap['elapsed']}s pos=({px},{py}) diamond={snap['player']['hasDiamond']} "
                      f"alarm={snap['alarm']}% guards={[g['state'] for g in snap['guards']]}")
            time.sleep(0.12)

        set_keys(set())
        snap = page.evaluate("window.__heist.snapshot()")
        print("RESULT:", result)
        if snap:
            print(f"  final: phase={snap['phase']} alarm={snap['alarm']}% max={snap['alarmMax']}% "
                  f"elapsed={snap['elapsed']}s loot=${snap['player']['lootValue']}")
        browser.close()


if __name__ == "__main__":
    main()
