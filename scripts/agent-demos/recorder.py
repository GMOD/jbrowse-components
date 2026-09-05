#!/usr/bin/env python3
# Records the whole GNOME/Wayland screen to an mp4 through GNOME Shell's own
# org.gnome.Shell.Screencast D-Bus interface — the one behind Ctrl+Alt+Shift+R,
# so no portal consent dialog. The catch this file exists for: GNOME ties the
# recording's life to the D-Bus connection that STARTED it, so gdbus call, which
# exits the moment the method returns, aborts the recording with "Sender has
# vanished". This process holds one connection open for the whole take.
#
# Usage: recorder.py <file_template_without_extension> <stop_flag_path> [max_seconds]
# Touch the stop-flag to finish; GNOME finalizes the mp4 and StopScreencast
# returns. The real output path (GNOME appends its configured container) is
# printed as "START ok=True path=...".
import sys
import os
import time
import gi

gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib  # noqa: E402

template = sys.argv[1]
stop_file = sys.argv[2]
max_seconds = float(sys.argv[3]) if len(sys.argv) > 3 else 900

bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
proxy = Gio.DBusProxy.new_sync(
    bus, Gio.DBusProxyFlags.NONE, None,
    'org.gnome.Shell.Screencast', '/org/gnome/Shell/Screencast',
    'org.gnome.Shell.Screencast', None)

# a{sv}: a plain dict whose values are variants, NOT a pre-wrapped Variant, or
# PyGObject rebuilds the dict from it and raises KeyError(0)
opts = {
    'framerate': GLib.Variant('i', 30),
    'draw-cursor': GLib.Variant('b', True),
}
ok, path = proxy.call_sync(
    'Screencast', GLib.Variant('(sa{sv})', (template, opts)),
    Gio.DBusCallFlags.NONE, -1, None).unpack()
print(f'START ok={ok} path={path}', flush=True)
if not ok:
    sys.exit(3)

deadline = time.time() + max_seconds
while time.time() < deadline and not os.path.exists(stop_file):
    time.sleep(0.25)

stopped, = proxy.call_sync(
    'StopScreencast', None, Gio.DBusCallFlags.NONE, -1, None).unpack()
print(f'STOP stopped={stopped}', flush=True)
