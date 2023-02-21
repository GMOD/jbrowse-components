---
id: develop_web_and_desktop_tutorial
title: Developing with JBrowse web and desktop
toplevel: true
---

import Figure from '../figure'

The following guide will walk you through setting up a developer environment for
development with JBrowse web and JBrowse desktop.

This guide will provide some steps from the perspective of a plugin developer,
but if you are interested in contributing to
[jbrowse-components](https://github.com/GMOD/jbrowse-components/), the setup
steps are equally relevant.

## Prerequisites

- git
- A stable and recent version of [node](https://nodejs.org/en/)
- yarn or npm
- basic familiarity with the command line, React, package management, and npm

## Setup JBrowse 2 using the latest developer build

The code for both JBrowse web and JBrowse desktop is found in the
[jbrowse-components](https://github.com/GMOD/jbrowse-components/) repository.
First we're going to clone the repo and install the dependencies.

```bash
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
yarn # or npm i
```

### To run JBrowse web

```bash
cd products/jbrowse-web
yarn start # or npm run
```

JBrowse web will by default spin up on http://localhost:3000.

<Figure caption="Screenshot of the 'no config.json found' screen of JBrowse web. This is what you will see when first spinning up JBrowse web." src="/img/config_not_found.png"/>

You can select one of the sample configs to poke around with or to immediately
start seeing changes you make in the codebase, or you can run JBrowse against a
config with the plugin you're developing. See
[the plugin tutorial](/docs/tutorials/simple_plugin) if you need help starting
with plugin development.

If you have a plugin running on port 9000 from the plugin tutorial, navigate to

```
http://localhost:3000/?config=http://localhost:9000/jbrowse_config.json
```

and you'll see the pluggable elements you've added through your plugin on your
running JBrowse session.

<Figure caption="If you haven't made any changes to the plugin template, you'll see 'Hello view' in the Add menu, as shown in this screenshot." src="/img/template_hello_view.png"/>

### To run JBrowse desktop

Open two tabs in your terminal at `~/jbrowse-components`; in one tab, run:

```bash
cd products/jbrowse-desktop
yarn start
```

And in the other tab, run:

```bash
cd products/jbrowse-desktop
yarn electron
```

Doing this, you can quickly restart the "react app" part of JBrowse (the tab
where you ran `yarn electron`) during your development without having to wait
for the electron app (`yarn start` tab) to restart.

A new window running JBrowse desktop will open.

### Running JBrowse desktop with a plugin in development

The following assumes your plugin is running on port `9000`, as shown in the
[the plugin tutorial](/docs/tutorials/simple_plugin).

JBrowse will open on the splash screen when first spun up. The easiest way to
see your local plugin running on JBrowse desktop is to select a quickstart
assembly (under "Launch new session" on the left side of the screen) and then
press "Go".

<Figure caption="The JBrowse desktop splash screen has some sample assemblies on the left panel." src="/img/desktop-landing.png" />

Then navigate: `Tools` -> `Plugin Store` and press the button at the top of the
Plugin Store widget "Add Custom Plugin."

<Figure caption="The 'Add Custom Plugin' button is at the top of the Plugin Store in JBrowse desktop." src="/img/desktop_add_cstm_plgn.png" />

It's important to fill these fields in correctly, if you've followed the
[the plugin tutorial](/docs/tutorials/simple_plugin), the information you need
will be in the `jbrowse_config.json` file.

You might see something like the following in your `jbrowse_config.json` file:

```json
{
  "plugins": [
    {
      "name": "SomeNewPlugin",
      "url": "http://localhost:9000/dist/some-new-plugin.umd.development.js"
    }
  ]
}
```

To which you would fill the fields in like so:

<Figure caption="After pressing the button a modal will open with some fields to fill in. Pictured above, your fields filled in might look like this. Make sure they match the information from your plugin project, that is currently running." src="/img/desktop_add_cstm_plgn_modal.png" />

After pressing "Submit" on this form, your plugin should be added to your
session.

For easy access to this session, navigate `File` -> `Save as..` to save the
`.jbrowse` file somewhere you can easily open it.

:::warning Note When developing your plugin using JBrowse desktop, the app will
not automatically reload when you make changes to your plugin code. To see these
changes applied, **press `F5` to refresh the desktop react application**.

You can also abort the running process under the "yarn electron" tab we set up
earlier, and start it again. :::

:::info If you would like to see your `console.log` output under the "yarn
electron" tab of your desktop development environment, follow these steps:

1. Create or edit the `.bash_profile` file typically found in the root directory
   of your profile
2. Add `export ELECTRON_ENABLE_LOGGING=1` on a new line to the file
3. Restart your terminal and JBrowse `yarn electron` process

You should now be able to see console log statements in your terminal when
developing on JBrowse desktop (denoted by a message prefixed with something like
INFO:CONSOLE). :::

## Next Steps

Now that you have your environments and your plugin running, you can start
developing for JBrowse 2.

If you took a detour from the plugin tutorial,
[head back to where you left off](/docs/tutorials/simple_plugin).

If you'd like some general development information, checkout the series of
[developer guides](/docs/developer_guide) available.
