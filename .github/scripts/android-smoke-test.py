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


def tap(root, label):
    node = next(n for n in root.iter() if (n.get("text") or n.get("content-desc")) == label)
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.attrib["bounds"]))
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def screenshot(name):
    with (OUT / name).open("wb") as image:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=image, check=True)


try:
    adb("install", "artifacts/MotoGo-android-standalone-test.apk")
    adb("reverse", "--remove-all")
    adb("shell", "am", "force-stop", PACKAGE)
    adb("logcat", "-c")
    print(adb("shell", "am", "start", "-W", "-n", f"{PACKAGE}/.MainActivity"))
    root = wait_for_text("Tu próximo viaje empieza aquí.")
    # Registration must preserve the selected role and validate before any API call.
    tap(root, "Elegir conductor")
    root = wait_for_text("Crear cuenta")
    tap(root, "Crear cuenta")
    root = wait_for_text("Registrarme como conductor")
    screenshot("register-driver.png")
    tap(root, "Registrarme como conductor")
    root = wait_for_text("Escribe tu nombre completo.")
    tap(root, "Volver al inicio")
    root = wait_for_text("Crear cuenta")
    tap(root, "Elegir pasajero")
    root = wait_for_text("Crear cuenta")
    tap(root, "Crear cuenta")
    root = wait_for_text("Registrarme como pasajero")
    tap(root, "Volver al inicio")
    root = wait_for_text("Ya tengo una cuenta")
    tap(root, "Ya tengo una cuenta")
    root = wait_for_text("Inicia sesión")
    tap(root, "Entrar a MotoGo")
    root = wait_for_text("Escribe un correo electrónico válido.")
    tap(root, "Volver al inicio")
    root = wait_for_text("Explorar la demo sin cuenta →")
    labels = {n.get("text") or n.get("content-desc") for n in root.iter()}
    assert "Continuar con Google" in labels and "Continuar con Facebook" in labels
    tap(root, "Explorar la demo sin cuenta →")
    root = wait_for_text("Mapa no disponible")
    # Exercise navigation after JS has loaded, including remounting the map area.
    for tab, expected in [("Conductor", "Tus viajes"), ("Pasajero", "Mapa no disponible")]:
        tap(root, tab)
        root = wait_for_text(expected)
    tap(root, "Volver al inicio")
    wait_for_text("Tu próximo viaje empieza aquí.")
    adb("shell", "am", "force-stop", PACKAGE)
    adb("shell", "am", "start", "-W", "-n", f"{PACKAGE}/.MainActivity")
    wait_for_text("Tu próximo viaje empieza aquí.")
    print("PASS: account welcome, driver/passenger registration, form validation, social choices, and explicit demo navigation without Metro")
finally:
    (OUT / "logcat.txt").write_text(adb("logcat", "-d"))
    screenshot("screen.png")
