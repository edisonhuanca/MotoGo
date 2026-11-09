"""Cold-start the installed release APK with no Metro and verify its UI."""
import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = "pe.motogo.chimbote"
OUT = pathlib.Path("smoke-results")
OUT.mkdir(exist_ok=True)


def adb(*args):
    return subprocess.check_output(["adb", *args], text=True).strip()


def wait_for_text(text):
    for _ in range(15):
        time.sleep(2)
        if not adb("shell", "pidof", PACKAGE):
            raise AssertionError("MotoGo exited after launch")
        adb("shell", "uiautomator", "dump", "/sdcard/motogo-ui.xml")
        xml = adb("shell", "cat", "/sdcard/motogo-ui.xml")
        (OUT / "ui.xml").write_text(xml)
        root = ET.fromstring(xml)
        if any(text in (node.get("text", "") or node.get("content-desc", "")) for node in root.iter()):
            return root
    raise AssertionError(f"UI did not display: {text}")


try:
    adb("install", "artifacts/MotoGo-android-standalone-test.apk")
    adb("reverse", "--remove-all")
    adb("shell", "am", "force-stop", PACKAGE)
    adb("logcat", "-c")
    print(adb("shell", "am", "start", "-W", "-n", f"{PACKAGE}/.MainActivity"))
    root = wait_for_text("Mapa no disponible")
    # Exercise navigation after JS has loaded, including remounting the map area.
    for tab, expected in [("Conductor", "Tus viajes"), ("Pasajero", "Mapa no disponible")]:
        node = next(n for n in root.iter() if (n.get("text") or n.get("content-desc")) == tab)
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.attrib["bounds"]))
        adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
        root = wait_for_text(expected)
    print("PASS: release APK opens on an Android tablet without Metro or a Maps key")
finally:
    (OUT / "logcat.txt").write_text(adb("logcat", "-d"))
    with (OUT / "screen.png").open("wb") as screenshot:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=screenshot, check=True)
