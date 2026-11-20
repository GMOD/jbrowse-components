---
name: linux-appimage-claims-jbrowse-links-itself
description: "On Linux a jbrowse:// link does nothing unless the user integrates the AppImage. The app could write its own .desktop file on first run and claim the scheme; the call is whether an app may write into ~/.local/share/applications unasked."
---

# The Linux AppImage claims jbrowse:// links itself

A bare AppImage installs none of its metadata, so the
`x-scheme-handler/jbrowse` MimeType in its `.desktop` file
(`products/jbrowse-desktop/scripts/packaging/linux.ts`) takes effect only for a
user who runs AppImageLauncher or `appimaged`. Everyone else clicks a docs
"Open in Desktop" link and nothing happens; the README and
`quickstart_desktop.md` send them to paste the link instead.

**The proposal:** on a Linux launch from an AppImage (`process.env.APPIMAGE`
set), write `~/.local/share/applications/jbrowse-desktop.desktop` with
`Exec="$APPIMAGE" %U` and the same MimeType line, then register it as the
`jbrowse` handler (`xdg-mime default jbrowse-desktop.desktop
x-scheme-handler/jbrowse`). Rewrite it when `$APPIMAGE` moves, since a new
version usually lands at a new path. The `.jbrowse` file association could ride
along, with the mime package from `sessionFileType.ts` copied to
`~/.local/share/mime/packages`.

**The call:** this writes into the user's home without asking, which is what
AppImageLauncher exists to make a choice. A middle road is to offer it once,
from the start screen's "Open JBrowse Web link..." path, which is where a user
whose link did nothing lands.

**Unverified:** whether `app.setAsDefaultProtocolClient`, which `electron.ts`
already calls on every platform, does any of this on Linux once a matching
`.desktop` file exists. Check before writing the `xdg-mime` call by hand.
