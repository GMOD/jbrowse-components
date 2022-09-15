---
id: 02_installation_and_setup
title: Installation and setup
toplevel: true
---

import Figure from '../../figure'

First we're going to install and set up the project for development.

## Use git to clone the plugin template

The easiest way to start developing your plugin for JBrowse 2 is to use the [plugin template](https://github.com/gmod/jbrowse-plugin-template).

To clone the plugin template project, on the command line run:

```bash
# change jbrowse-plugin-my-project to whatever you wish
git clone https://github.com/GMOD/jbrowse-plugin-template.git jbrowse-plugin-my-project
cd jbrowse-plugin-my-project
```

## Initialize the project

To initialize your project run,

```bash
yarn init
```

You'll be asked a few questions relating to your new project.

Most fields can be left blank, but **make sure to enter a descriptive name for your plugin** in the first field.

:::note Tip

A typical naming convention for JBrowse plugins is **"jbrowse-plugin-"**, or, if you are going to publish to an NPM organization, we advise **"@myscope/jbrowse-plugin-"**.

:::

You also need to install the dependencies:

```bash
yarn # or npm i
```

## Setup JBrowse 2

Finally, we're going to run:

```bash
yarn setup
```

which will grab the latest release version of JBrowse 2 (in the `.jbrowse` directory) and make it easy for you to run within your plugin project.

To run JBrowse:

```bash
yarn browse
```

You should see something like the following:

```bash
yarn run v1.22.10
$ npm-run-all jbrowse:*
$ shx cp jbrowse_config.json .jbrowse/config.json
$ cross-var serve --listen $npm_package_config_browse_port .jbrowse
UPDATE AVAILABLE The latest version of `serve` is 14.0.1

   ┌────────────────────────────────────────────────┐
   │                                                │
   │   Serving!                                     │
   │                                                │
   │   - Local:            http://localhost:8999    │
   │   - On Your Network:  http://10.0.0.117:8999   │
   │                                                │
   │   Copied local address to clipboard!           │
   │                                                │
   └────────────────────────────────────────────────┘
```

We still need to run the plugin though; we need **both to be running** to test our plugin.

Open a new tab in your terminal and navigate again to your plugin project, then we're going to run our plugin:

```bash
cd jbrowse-plugin-my-project
yarn start
```

Now you can navigate to [http://localhost:8999/](http://localhost:8999/), and see your running JBrowse instance!

<Figure caption="Your browser should look something like the above screenshot." src="/img/plugin_template_spin_up_start.png"/>

:::info Note
At this point, you _must_ be running your plugin on port `9000` to see a running JBrowse instance, otherwise you will meet a screen asking you to configure your instance.

If you'd like to change this port, you can edit the "port" fields under "config" in the `package.json` file.
:::

We can verify our plugin has been added to our JBrowse session by clicking the first square on the splash screen "Empty," and then navigating `Add` -> `Hello View` in the menu bar. This is the example pluggable element that is added in the template plugin project.

Next, we're going to add our own pluggable element to the plugin.

If you're building a small plugin, or only want to develop against the latest release version, you can [move on to the next step](../03_adding_pluggable_element).

However, if you:

- want to run your plugin on JBrowse desktop
- would like more descriptive stack traces and debugging
- want to test your plugin against the most recent developer build

You can develop against the latest JBrowse core build by taking a quick detour to our [developing with JBrowse web and desktop tutorial](../../develop_web_and_desktop_tutorial).
