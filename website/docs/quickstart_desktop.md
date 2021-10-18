---
id: quickstart_desktop
title: Quick start for JBrowse desktop
toplevel: true
---

import Figure from './figure'
import PlaylistAddIcon from '@material-ui/icons/PlaylistAdd'

## Installing JBrowse desktop

This guide will walk you through installing jbrowse 2 on the desktop

JBrowse 2 desktop does not require any pre-requisites for your installation, so
we can jump right in

### Installing on Linux

Visit http://github.com/gmod/jbrowse-components/releases/latest and find the
latest Linux AppImage release. Download that file to wherever you would like to
keep it and then start it in one of two ways:

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

### Installing on MacOS

Visit http://github.com/gmod/jbrowse-components/releases/latest and find the
latest MacOS release artifact in our latest builds.

Download the .dmg file for MacOS, double click, and drag JBrowse 2 into 'applications'.

You can now open JBrowse 2 like any other application on your Mac.

### Installing on Windows

Visit http://github.com/gmod/jbrowse-components/releases/latest and download the
latest Windows installer executable (will end with `win.exe`).

Double-click the downloaded installer and it will install and open JBrowse.
You can now open JBrowse like any other program.

## JBrowse Desktop start screen

After you have installed and started JBrowse Desktop you will see a start
screen like this

<Figure src="/img/desktop-landing.png" caption="Screenshot showing the start screen on JBrowse desktop"/>

The left hand panel, with "Launch new session" can quickly launch a new session
using either your own custom genome (which you can load using an indexed FASTA
or a twobit file). Also on the left hand panel is the "Quickstart list". Users
can click the checkbox next to e.g. hg38 and hit Go.

On the right hand panel is the "Recently opened sessions". This includes
sessions that you have specifically saved, and sessions that were autosaved
(e.g. ones that you didn't explicitly use "Save as" on). You can re-open your
sessions by clicking on the link.

### Special features on the start screen

#### Converting a saved session into a quickstart entry

If you study a rare species, you might find it useful to customize your
quickstart panel. We allow you to convert a session in the "Recently opened
sessions" into an entry that appears in the quickstart list.

To do so: Click a checkbox next to a session in the "Recently opened sessions"
table, and then hit the <PlaylistAddIcon /> icon next to the trash can icon.
This is helpful if e.g. you want to make your own custom organism a template
for quickstarts in the future.

#### Selecting multiple entries from the quickstart panel

Users can also hit
the checkbox for multiple species in the quickstart list, and then the sessions
are combined which is helpful if e.g. you are doing comparative genomics of
hg19 and mm10.

### Next steps

Check out the [user guide](../user_guide) for more info on how to use JBrowse
Desktop. This covers all the features that are available with screenshots and
instructions.
