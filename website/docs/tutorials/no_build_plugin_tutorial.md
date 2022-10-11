---
id: no_build_plugin_tutorial
title: Writing a no-build plugin
toplevel: true
---

import Figure from '../figure'

The following guide will provide a short tutorial on how to create a single page no-build plugin for JBrowse 2.

## Prerequisites

- you can run an instance of JBrowse 2 on the web, see [any of our quickstart guides](../../quickstart_cli) for details
- A stable and recent version of [node](https://nodejs.org/en/)
- basic familiarity with the command line and navigating the file system

## What is the difference between a no-build plugin and a regular plugin?

A no-build plugin can be a single file that executes all the required code to plug into JBrowse and supplement the functionality of the application with new (simple) features.

This is in contrast to a "regular" JBrowse plugin that might have a large dependency tree, have substantial adapter logic, or other components that require the entire application build process to execute for the plugin to run properly.

:::info No-build plugins are great for simple additions to JBrowse

A single file can easily be hosted in an AWS bucket or otherwise hosted online with minimal resources, and adding it to a JBrowse session is as simple as the "regular" plugin process.

:::

## Writing a no-build plugin

In this tutorial, we're going to add a menu item to our toolbar that opens up a JBrowse widget with citation information.

### Set up

Create a single `.js` file in an accessible directory.

The only critical component of this file is an exported class that will act as our plugin, your template for this file might look like the following:

`MyNoBuildPlugin.js`

```js
export default class MyNoBuildPlugin {
  name = 'MyNoBuildPlugin'
  version = '1.0'

  install(pluginManager) {}

  configure(pluginManager) {}
}
```

### Adding a menu item

A simple no-build plugin is perfect for adding small features to JBrowse, like menu items or minor extension points.

Here, we're going to add a menu item using the `configure` method in the plugin class.

`MyNoBuildPlugin.js`

```js
// ...
  configure(pluginManager) {
    // adding a new menu to the top toolbar
    pluginManager.rootModel.insertMenu('Citations', 4)

    // appending a menu item to the new menu
    pluginManager.rootModel.appendToMenu('Citations', {
      label: 'Cite this JBrowse session',
      onClick: (session) => { }
    })
  }
// ...
```

### Importing with jbrequire

Because our plugin is not going to be built with any dependencies, the process for referencing external libraries is a little different.

The first way to do this is to reference the packages directly; typically the easiest way to do this is to use the library's unpkg, as follows:

```js
import React from 'https://unpkg.com/es-react@latest/dev/react.js'
```

If a package you need to use is found within the JBrowse core project, a special function `jbrequire` can provide your plugin access to these packages. Click [here](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/ReExports/list.ts) for a full list of packages accessible through `jbrequire`. Using `jbrequire` might look like this:

```js
const { types } = pluginManager.jbrequire('mobx-state-tree')
```

which would provide the functionality of mobx-state-tree through that value.

:::info
Importing `React` with a direct reference is for example only for the purposes of this tutorial. It's best practice to always use `jbrequire` when you can to reference packages.

Make sure to reference the [list of exported packages](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/ReExports/list.ts) accessible
through `jbrequire` before moving forward with importing a package directly.
:::

### Executing some functionality

Using our new imports, we're going to add a small functionality to this plugin; we're going to add a widget that opens up with some text.

Our final no-build plugin looks as follows:

`MyNoBuildPlugin.js`

```js
// if you have any libraries external to what is available using jbrequire make sure to import them at the top of your js file
// import React from 'https://unpkg.com/es-react@latest/dev/react.js'

export default class MyNoBuildPlugin {
  name = 'MyNoBuildPlugin'
  version = '1.0'

  install(pluginManager) {
    // here, we use jbrequire to reference packages exported through JBrowse
    const { ConfigurationSchema } = pluginManager.jbrequire(
      '@jbrowse/core/configuration',
    )
    const WidgetType = pluginManager.jbrequire(
      '@jbrowse/core/pluggableElementTypes/WidgetType',
    )
    const { ElementId } = pluginManager.jbrequire(
      '@jbrowse/core/util/types/mst',
    )
    const { types } = pluginManager.jbrequire('mobx-state-tree')

    const React = pluginManager.jbrequire('react')

    // this is our react component
    const CiteWidget = props => {
      // React.createElement can be used to add html to our widget component
      const header = React.createElement(
        'h1',
        null,
        'Cite this JBrowse session',
      )
      const content = React.createElement(
        'p',
        null,
        `Diesh, Colin, et al. "JBrowse 2: A modular genome browser with views of synteny and structural variation. bioRxiv. 2022.`,
      )

      return React.createElement('div', null, [header, content])
    }

    // we're adding a widget that we can open upon clicking on our menu item
    pluginManager.addWidgetType(() => {
      // adding a widget to the plugin
      return new WidgetType({
        name: 'CiteWidget',
        heading: 'Cite this JBrowse session',
        configSchema: ConfigurationSchema('CiteWidget', {}),
        stateModel: types.model('CiteWidget', {
          id: ElementId,
          type: types.literal('CiteWidget'),
        }),
        // we're going to provide this component ourselves
        ReactComponent: CiteWidget,
      })
    })
  }

  configure(pluginManager) {
    pluginManager.rootModel.insertMenu('Citations', 4)

    pluginManager.rootModel.appendToMenu('Citations', {
      label: 'Cite this JBrowse session',
      onClick: session => {
        // upon clicking on htis menu item, we need to add and show our new widget
        const widget = session.addWidget('CiteWidget', 'citeWidget', {
          view: self,
        })
        session.showWidget(widget)
      },
    })
  }
}
```

## Adding the plugin to the config

We'll need to add our plugin to our config file. You can add to an existing file, or create a new one (e.g. `touch jbrowse_config.json`).

With a file processor, open your `jbrowse_config.json` and add the following to the configuration:

```json
{
  "plugins": [
    {
      "name": "MyNoBuildPlugin",
      "esmUrl": "http://localhost:9000/MyNoBuildPlugin.js"
    }
  ]
}
```

It's important to note that the `name` and `esmUrl` must be accurate to the name of your plugin and the name of your file respectively. If localhost:9000 is in use, change the port in the following step.

Now, for the purposes of this tutorial, we can access our file through localhost to make sure it's working. In production, you'll want this file to be accessible through the web.

To start a simple webserver to host our files, run the following in the directory containing your `.js` file and your config (if applicable):

```bash
npx serve --cors --listen 9000 .
```

<Figure caption="Screenshot of what your directory might look like when served on a localhost." src="/img/no_build_localhost.png"/>

## Running with JBrowse

Now we can test our plugin by running our config against an instance of JBrowse.

Spin up JBrowse web through your method of choice (see one of our [quickstart guides](../../quickstart_cli) if you have not done this already).

Navigate to your JBrowse web instance, and provide it your configuration using the URL parameters. It might look something like the following:

```
http://localhost:3000/?config=http://localhost:9000/jbrowse_config.json
```

With JBrowse running and your plugin added to your config, your JBrowse session should look like the following:

<Figure caption="Screenshot of a running JBrowse instance with the simple no build plugin added. Note our top level menu item has been added, and upon clicking it our widget opens." src="/img/no_build_final.png"/>

## Conclusion and next steps

Congratulations! You built and ran a single file no-build plugin in JBrowse.

If you'd like some general development information, checkout the series of [developer guides](../../developer_guide) available.

Have some questions? [Contact us](/contact) through our various communication channels.
