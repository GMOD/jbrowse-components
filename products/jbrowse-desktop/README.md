# JBrowse Desktop

## Development environment

### Developing

While in the jbrowse-desktop directory, you can run `yarn start` to start a
development build of JBrowse Desktop. This both starts the development server
and opens the Electron window when the server is ready.

For more control over the development, you can run the server and the electron
window separately. Just run `yarn serve` to start the server, and once the
server is ready run `yarn develop` to open the Electron window.

The Electron process can also take a custom server URL in case you run the dev
server on another machine, e.g. `DEV_SERVER_URL=http://some.url yarn develop`.

### Packaging

You will need some development libraries installed to be able to package the
application, since native dependencies have to be rebuilt.

#### Linux

To install the development libraries:

```sh
# To build for Linux and Mac
sudo apt install -y python make gcc libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
# To build for Windows, you additionally need
sudo apt install -y wine-stable
```

`yarn build-electron` will then build and package the application for Linux,
Mac, and Windows. You can also use `yarn build-electron:win`,
`yarn build-electron:linux`, or `yarn build-electron:mac` to build and package
for a specific platform.

#### MacOS

To install the development libraries on Mac:

```sh
# To build for Linux and Mac
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

#### Windows

Only the Windows application can be packaged when developing on a Windows
machine. Trying to package the Linux or Mac applications will fail. To install
the development libraries:

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

Then you can run `yarn build-electron:win` to build and package the Windows
application.
