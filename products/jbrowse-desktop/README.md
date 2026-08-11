# JBrowse Desktop

## Development environment

### Developing

While in the jbrowse-desktop directory, you can run `pnpm start` to start a
development build of JBrowse Desktop. This both starts the development server
and opens the Electron window when the server is ready.

### The `jbrowse://` url scheme

Desktop claims `jbrowse://open?url=<url-encoded JBrowse Web link>`, so a web
page (the docs' figure links) can open a view here. The whole web link is
carried as one encoded parameter rather than by copying its query, so a config
relative to the web instance still resolves against it.

The pieces, and where each platform registers the scheme:

| Piece                                                 | Where                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrap/unwrap + argv parsing (pure, unit-tested)        | `electron/launchTarget.ts`                                                                                                                                    |
| Delivery: argv, `second-instance`, macOS `open-url`   | `electron/electron.ts`                                                                                                                                        |
| Handed to the renderer as `?specLink=`                | `electron/window.ts` (`buildAppUrl`)                                                                                                                          |
| Renderer builds the session                           | `src/components/usePluginManagerLoad.ts` → `openSpecLink` (`StartScreen/util.tsx`)                                                                            |
| Same session, pasted instead of linked                | Start screen "Open" menu (`StartScreen/recentSessions/RecentSessionsPanel.tsx`) or File → Session → "Open JBrowse Web link..." (`src/rootModel/rootModel.ts`) |
| macOS registration (`CFBundleURLTypes` in Info.plist) | `scripts/packaging/packager.ts` (`protocols`)                                                                                                                 |
| Windows registration (`HKCU\Software\Classes`)        | `scripts/packaging/windows.ts` (NSIS install/uninstall)                                                                                                       |
| Linux — see the caveat below                          | `scripts/packaging/linux.ts` (`.desktop` `MimeType`, `Exec=AppRun %U`)                                                                                        |

**Linux registers nothing on its own.** We ship a bare AppImage, which doesn't
install its `.desktop` file, and nothing reads a scheme handler out of an
un-integrated AppImage. The `x-scheme-handler/jbrowse` MimeType we embed is a
_prerequisite_, not a registration: it only takes effect if the user integrates
the AppImage with their desktop (AppImageLauncher, `appimaged`), which copies
that `.desktop` into `~/.local/share/applications`. So on Linux the link usually
does nothing, and **pasting it into "Open JBrowse Web link..." is the real
path** — it needs no OS registration and works everywhere, as does passing the
`jbrowse://` url as a command-line argument. That entry sits both on the start
screen's "Open" menu (where a user whose link did nothing actually lands) and
under File → Session once a session is open. Don't claim otherwise in the docs.

**A jbrowse:// url is untrusted input** — any web page can make the OS open one.
`parseProtocolUrl` therefore only ever yields an `http`/`https` link, so
`jbrowse://open?url=file:///…` cannot turn a link click into a local-file read.
Keep that restriction if you touch it.

Only the pure parsing is unit-tested (`electron/launchTarget.test.ts`); the OS
registration cannot be tested from a checkout. After changing anything in the
table above, smoke-test a **packaged** build per platform: install it, then open
a `jbrowse://open?url=…` link from a browser, both with the app closed (cold
start) and already running (`second-instance` / `open-url`).

### The `.jbrowse` file association

A saved session opens on double-click. The app end of this is the same machinery
as the url scheme — `findLaunchTarget` reads a file argument off argv,
`openTarget` loads it — so all that is platform-specific is telling the OS which
extension to hand us.

Each platform declares it in its own format, and they are declarations of the
same three facts — this extension, this type, this application:

| Platform    | Where                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------- |
| The type    | `scripts/packaging/sessionFileType.ts` (pure; the mime package and the Info.plist keys)             |
| **Windows** | `scripts/packaging/nsisScript.ts` — registry, install and uninstall                                 |
| **macOS**   | `scripts/packaging/packager.ts` (`extendInfo`)                                                      |
| **Linux**   | `scripts/packaging/linux.ts` — mime package + `.desktop` `MimeType`, with the AppImage caveat below |

**Windows** registers a `JBrowse2.Session` ProgID (icon, type description, open
command) and points `HKCU\Software\Classes\.jbrowse` at it, rather than putting
a command directly under the extension key — that older form still launches, but
Explorer shows no icon and no type in the Type column. It also lists the ProgID
under `OpenWithProgids`, which is where a user goes when something else holds
the default, and calls `SHChangeNotify(SHCNE_ASSOCCHANGED)`, without which
Explorer serves its cached associations until the next logon.

**macOS** both _exports the type_ (`UTExportedTypeDeclarations`, since we are
the application that invented `.jbrowse`) and declares that it opens it
(`CFBundleDocumentTypes`, as `Editor` — a session opened from the Finder can be
written back into its own file). A `CFBundleDocumentTypes` entry can instead
carry a bare `CFBundleTypeExtensions` list, which LaunchServices still honours;
the reason not to is that nothing else on the system then knows what a
`.jbrowse` file _is_. Note the app also handles `open-file` for a drag onto the
dock icon, which needs no registration at all — don't take that working as
evidence the association does.

**Linux** ships a shared-mime-info package defining `application/x-jbrowse` with
a `*.jbrowse` glob. The `.desktop` file has named that type in its `MimeType=`
line for years, but `MimeType=` only says _this application handles that type_ —
nothing said which files were of it, so no session ever matched and the line was
inert. The same AppImage caveat as the url scheme still applies on top: a bare
AppImage installs none of its own metadata, so this makes the association
possible for a user who integrates the AppImage rather than making it happen.

**`.json` is deliberately not claimed**, on any platform, although
`findLaunchTarget` opens one perfectly well. It is the most common config format
on a developer's machine and an install has no business taking the default for
all of them. `nsis.test.ts` pins that.

Three things are easy to get wrong here and are pinned by tests, so read them
before you change any of them. Extensions are matched **case-insensitively**
(`hasSessionExtension`), because Windows' association is — Explorer will hand us
`Session.JBROWSE`, and a case-sensitive predicate turns that into an app that
silently opens to the start screen. The Windows uninstall removes only **values
it wrote**, never the extension key recursively: `OpenWithProgids` is a list
shared with every other application that can open the type. And every platform's
declaration of the extension is **derived from `SESSION_EXTENSION`**, never
retyped — `sessionFileType.test.ts` exists mostly to keep them from drifting,
which is how the inert MimeType line above happened.

Neither non-Windows output has a compile step, but both go in front of their
consumer without a build; `sessionFileType.ts`'s header has the two commands.
Beyond that, this needs a packaged install to smoke-test, per platform: save a
session, double-click it with the app closed and again with it running, and
check the icon and type description the file manager shows. On Windows, then
uninstall and confirm the extension is no longer claimed.

### Packaging

You will need some development libraries installed to be able to package the
application, since native dependencies have to be rebuilt.

#### Linux

To install the development libraries:

```sh
sudo apt install -y python make gcc libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

`pnpm package:linux` will build and package the application as an AppImage.

#### macOS

To install the development libraries on Mac:

```sh
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

`pnpm package:mac` will build and package the application as a DMG and ZIP.

For code signing and notarization, set these environment variables:

- `APPLE_ID` - Your Apple ID email
- `APPLE_ID_PASSWORD` - App-specific password

Signing is enabled whenever `APPLE_ID` is set. Notarization additionally
requires `APPLE_ID_PASSWORD` and only runs in CI (`GITHUB_ACTIONS`); the release
job notarizes the app and staples the ticket so Gatekeeper validates it offline.

#### Windows

To install the development libraries on Windows:

```pwsh
# Run in an elevated PowerShell window (i.e. use "Run as administrator")
# Most of these instructions come from https://github.com/Automattic/node-canvas/wiki/Installation:-Windows#install-manually

npm install --global --production windows-build-tools
cd C:\
# If you have 32bit, use this below instead: http://ftp.gnome.org/pub/GNOME/binaries/win32/gtk+/2.24/gtk+-bundle_2.24.10-20120208_win32.zip
Invoke-WebRequest -Uri http://ftp.gnome.org/pub/GNOME/binaries/win64/gtk+/2.22/gtk+-bundle_2.22.1-20101229_win64.zip -OutFile .\gtk+-bundle_2.22.1-20101229_win64.zip
Expand-Archive .\gtk+-bundle_2.22.1-20101229_win64.zip -DestinationPath .\GTK
Remove-Item -path .\gtk+-bundle_2.22.1-20101229_win64.zip

# Next part has to be done in the GUI
# Go to http://sourceforge.net/projects/libjpeg-turbo/files/ and download latest VC (64bit or 32bit) exe (e.g. libjpeg-turbo-2.0.3-vc64.exe)
# Install to C:\libjpeg-turbo if 32bit or C:\libjpeg-turbo64 if 64bit
```

`pnpm package:win` will build and package the application as an NSIS installer
(or portable ZIP if NSIS is not available).

The installer is per-user (installs under `%LOCALAPPDATA%\Programs`, registers
under `HKCU`, requires no admin/UAC), so electron-updater can apply background
updates silently and relaunch the app. Note: users on an older per-machine build
(installed under Program Files) will get a fresh per-user install on their next
update rather than an in-place upgrade.

For code signing, set these environment variables:

- `WINDOWS_SIGN_CREDENTIAL_ID`
- `WINDOWS_SIGN_USER_NAME`
- `WINDOWS_SIGN_USER_PASSWORD`
- `WINDOWS_SIGN_USER_TOTP`

### All platforms

You can also run `pnpm package` to build for the current platform automatically.
