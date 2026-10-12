#!/usr/bin/env python3
# Input for a headless GNOME Shell, which reads no /dev/input, so ydotool cannot
# reach it: mutter's own org.gnome.Mutter.RemoteDesktop on the session bus.
#
# Usage: remoteInput.py key <evdev code>...   press a chord, release in reverse
#        remoteInput.py move <dx> <dy>         move the pointer by that much
#
# Each call opens and closes its own session, so the top bar's remote-desktop
# indicator is gone again before the recording starts.
import sys
import time
import gi

gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib  # noqa: E402

BUS_NAME = 'org.gnome.Mutter.RemoteDesktop'
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)


def call(proxy, method, args=None):
    return proxy.call_sync(method, args, Gio.DBusCallFlags.NONE, -1, None)


desktop = Gio.DBusProxy.new_sync(
    bus, Gio.DBusProxyFlags.NONE, None,
    BUS_NAME, '/org/gnome/Mutter/RemoteDesktop', BUS_NAME, None)
(path,) = call(desktop, 'CreateSession').unpack()
session = Gio.DBusProxy.new_sync(
    bus, Gio.DBusProxyFlags.NONE, None,
    BUS_NAME, path, f'{BUS_NAME}.Session', None)
call(session, 'Start')

command, *rest = sys.argv[1:]
if command == 'key':
    codes = [int(c) for c in rest]
    for pressed, order in ((True, codes), (False, codes[::-1])):
        for code in order:
            call(session, 'NotifyKeyboardKeycode', GLib.Variant('(ub)', (code, pressed)))
            time.sleep(0.05)
elif command == 'move':
    dx, dy = (float(v) for v in rest)
    call(session, 'NotifyPointerMotionRelative', GLib.Variant('(dd)', (dx, dy)))
else:
    sys.exit(f'unknown command {command}')
time.sleep(0.2)
call(session, 'Stop')
