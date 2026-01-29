# JBrowse Desktop

## Development environment

### Developing

While in the jbrowse-desktop directory, you can run `pnpm start` to start a
development build of JBrowse Desktop. This both starts the development server
and opens the Electron window when the server is ready.

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

For code signing, set these environment variables:

- `WINDOWS_SIGN_CREDENTIAL_ID`
- `WINDOWS_SIGN_USER_NAME`
- `WINDOWS_SIGN_USER_PASSWORD`
- `WINDOWS_SIGN_USER_TOTP`

### All platforms

You can also run `pnpm package` to build for the current platform automatically.
