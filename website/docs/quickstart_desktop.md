---
id: quickstart_desktop
title: JBrowse desktop quick start
toplevel: true
---

import Figure from './figure'

import {winDL,macDL,linDL} from './links'

import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'

In this guide, we'll get the JBrowse desktop application running on your
computer.

## Installing JBrowse desktop

### Installing on Windows

Click <a href={winDL}>here</a> to download the latest Windows installer
executable.

Double-click the downloaded installer and it will install and open JBrowse. You
can now open JBrowse like any other program.

### Installing on MacOS

Click <a href={macDL}>here</a> to download the latest MacOS release artifact.

When the .dmg file is downloaded, double click, and drag JBrowse 2 into
'applications'.

You can now open JBrowse 2 like any other application on your Mac.

### Installing on Linux

Click <a href={linDL}>here</a> to download the latest Linux AppImage release.

Start it in one of two ways:

#### In the terminal

Using the AppImage file on linux, all that is needed is to make the file
executable which you can do in a terminal

```sh
# Make the AppImage file executable, only need to do this once
chmod  a+x jbrowse-desktop-*-linux.AppImage
# Run!
./jbrowse-desktop-*-linux.AppImage
```

#### In your file explorer

This may vary slightly depending on your distribution but should basically
follow these steps:

1. Right-click on the AppImage file and select "Properties"
2. Go to the "Permissions" tab
3. Check "Allow executing file as program" and close

You can now double-click the AppImage file to launch JBrowse.

## JBrowse Desktop start screen

After you have installed and started JBrowse Desktop you will see a start screen
like this:

<Figure src="/img/desktop-landing.png" caption="Screenshot showing the start screen on JBrowse desktop"/>

**On the left hand panel,** "Launch new session" can launch a new session using
either your own custom genome (which you can load using an indexed FASTA or a
twobit file via `open sequence file`) or a pre-loaded genome via the "Quickstart
list".

**On the right hand panel** is the "Recently opened sessions". This includes
sessions that you have explicitly saved, and sessions that were autosaved (i.e.
ones that you didn't explicitly use "Save as" on). You can re-open your sessions
by clicking on the session name.

### Special features on the start screen

#### Converting a saved session into a quickstart entry

If you study a rare species, you might find it useful to customize your
quickstart panel. You can convert a session in the "Recently opened sessions"
into an entry that appears in the quickstart list.

**To do this:** Click a checkbox next to a session in the "Recently opened
sessions" table, and then hit the <PlaylistAddIcon /> icon next to the trash can
icon. This is helpful if you want to make your own custom organism a template
for quickstarts in the future.

#### Selecting multiple entries from the quickstart panel

Users can also hit the checkbox for multiple species in the quickstart list, and
then the sessions are combined which can be helpful for comparative genomics.

### Next steps

Check out the [user guide](../user_guide) for more info on how to use JBrowse
Desktop. This covers all the features that are available with screenshots and
instructions.
