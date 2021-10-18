---
id: quickstart_desktop
title: Quick start for JBrowse desktop
toplevel: true
---

import Figure from './figure'

### Installing JBrowse desktop

This guide will walk you through installing jbrowse 2 on the desktop

JBrowse 2 desktop does not require any pre-requisites for your installation, so
we can jump right in

#### Installing on Linux

Visit http://github.com/gmod/jbrowse-components/releases/latest and find the
latest Linux AppImage release. Download that file to wherever you would like to
keep it and then start it in one of two ways:

##### In the terminal

```sh
# Make it executable, only need to do this once
chmod  a+x jbrowse-desktop-*-linux.AppImage
# Run!
./jbrowse-desktop-*-linux.AppImage
```

##### In your file explorer

This may vary slightly depending on your distribution but should basically
follow these steps:

1. Right-click on the AppImage file and select "Properties"
2. Go to the "Permissions" tab
3. Check "Allow executing file as program" and close

You can now double-click the AppImage file to launch JBrowse.

#### Installing on MacOS

Visit http://github.com/gmod/jbrowse-components/releases/latest and find the
latest MacOS release artifact in our latest builds.

Download the .dmg file for MacOS, double click, and drag JBrowse 2 into 'applications'.

You can now open JBrowse 2 like any other application on your Mac.

#### Installing on Windows

Visit http://github.com/gmod/jbrowse-components/releases/latest

You can then unzip this file and run the file that comes from unzipping it.
Moving this file to the Applications folder is also equivalent to "installing"
JBrowse 2

<Figure caption="Unzip the zip archive" src="/img/installation_win_unzip.png"/>
<Figure caption="You can then double click the exe application in the unzipped archive" src="/img/installation_win_run.png"/>

Then open up the Windows Explorer in the unzipped directory and run "JBrowse
2.exe". This may give a "Windows protected your PC" warning, but select "More
info..." and then "Run anyway"

<Figure caption="You can skip windows protection to run the app by clicking the 'More info...' link" src="/img/installation_win_protect2.png"/>
<Figure caption="After clicking 'More info...' the button to run is revealed" src="/img/installation_win_protect.png"/>
