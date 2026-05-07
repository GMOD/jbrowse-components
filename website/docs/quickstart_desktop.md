---
id: quickstart_desktop
title: JBrowse desktop quick start
toplevel: true
---

In this guide, we'll get the JBrowse desktop application running on your
computer.

## Installing JBrowse desktop

Go to the [download page](/jb2/download/) and download the installer for your
platform, or grab the latest release directly from
[GitHub releases](https://github.com/GMOD/jbrowse-components/releases/latest).

### Installing on Windows

Download the latest Windows installer executable (`.exe`).

Double-click the installer to install and open JBrowse.

### Installing on MacOS

Download the latest MacOS release artifact (`.dmg`).

Open the .dmg, then drag JBrowse 2 to Applications.

### Installing on Linux

Download the latest Linux AppImage release (`.AppImage`).

Start it in one of two ways:

#### In the terminal

Make the file executable:

```sh
# Make the AppImage file executable, only need to do this once
chmod  a+x jbrowse-desktop-*-linux.AppImage
# Run!
./jbrowse-desktop-*-linux.AppImage
```

#### In your file explorer

Steps may vary by distribution:

1. Right-click on the AppImage file and select "Properties"
2. Go to the "Permissions" tab
3. Check "Allow executing file as program" and close

You can now double-click the AppImage file to launch JBrowse.

## JBrowse Desktop start screen

After starting JBrowse Desktop, you'll see a start screen:

<Figure src="/img/desktop-landing.png" caption="Screenshot showing the start screen on JBrowse desktop"/>

**Left panel** — "Launch new session": open a custom genome (indexed FASTA or
2bit via `open sequence file`) or a pre-loaded genome from the "Quickstart
list".

**Right panel** — "Recently opened sessions": sessions you've explicitly saved
and autosaved ones. Click a session name to reopen it.

### Special features on the start screen

#### Converting a saved session into a quickstart entry

To add your own genome to the quickstart list, check the session in "Recently
opened sessions" and click the playlist-add icon (☰+) next to the trash can.

#### Selecting multiple entries from the quickstart panel

Check multiple species in the quickstart list to open them in a combined
session, useful for comparative genomics.

### Next steps

See the [user guides](/docs/user_guide) for guides on track types, views, and UI
features.
