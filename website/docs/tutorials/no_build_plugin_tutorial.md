---
id: no_build_plugin_tutorial
title: Writing a no-build plugin
toplevel: true
---

import Figure from '../figure'

The following guide will provide a short tutorial on how to create a single page
no-build plugin for JBrowse 2.

## Prerequisites

- you can run an instance of JBrowse 2 on the web, see
  [any of our quickstart guides](/docs/quickstart_web) for details
- a stable and recent version of [node](https://nodejs.org/en/)
- basic familiarity with the command line and navigating the file system

## What is the difference between a no-build plugin and a regular plugin?

A "regular" JBrowse plugin often uses our plugin template
https://github.com/GMOD/jbrowse-plugin-template which uses `rollup` to compile
extra dependencies that your plugin might use. In contrast, "no-build" plugins
have no build step and can be hand edited. This can be useful for adding
[extra jexl config callbacks for making extra config callbacks or similar modifications](/docs/config_guides/customizing_feature_colors/).

## Writing a no-build plugin

### Adding a callback function which you can use in your config

A common method for a no-build plugin might be making a custom function that you
can use to simplify `jexl` callbacks in your config. We will create a file
`myplugin.js`, which will contain a ["UMD"](https://github.com/umdjs/umd) module
providing a single "Plugin" class [1].

`myplugin.js`

```js
// the plugin will be a simplified UMD module, and we put the code in a
function to avoid variable name collisions with the global scope
;(function () {
  class Plugin {
    name = 'MyNoBuildPlugin'
    version = '1.0'

    install(pluginManager) {
      pluginManager.jexl.addFunction('customColor', feature => {
        if (feature.get('type') === 'exon') {
          return 'red'
        } else if (feature.get('type') === 'CDS') {
          return 'green'
        }
      })
    }

    configure(pluginManager) {}
  }

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginMyNoBuildPlugin =
    {
      default: Plugin,
    }
})()
```

Put this file `myplugin.js` in the same folder as your config file, and then,
you can refer to this plugin and the custom function you added in your config.

```json
{
  "plugins": [{ "name": "UMDLocPlugin", "umdLoc": { "uri": "myplugin.js" } }],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "mytrack",
      "name": "mytrack",
      "assemblyNames": ["hg19"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "gffGzLocation": {
          "uri": "file.gff.gz"
        },
        "index": {
          "location": {
            "uri": "file.gff.gz.tbi"
          }
        }
      },
      "displays": [
        {
          "type": "LinearBasicDisplay",
          "displayId": "mytrack-LinearBasicDisplay",
          "renderer": {
            "type": "SvgFeatureRenderer",
            "color1": "jexl:customColor(feature)"
          }
        }
      ]
    }
  ]
}
```

[1] Note that you can also provide an ESM module that has just
`export default class` but this is not supported by all browsers, notably
firefox, which cannot import ESM files in webworkers, so for maximum
compatibility, we show are using the UMD format still. Once firefox gains
support for ESM modules, we will update this!

### Adding a global menu item

Another example of a no-build plugin is to add menu items or minor extension
points. Here, we're going to add a menu item using the `configure` method in the
plugin class.

`myplugin.js`

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

Because our plugin is not going to be built with any dependencies, the process
for referencing external libraries is a little different.

If a package you need to use is found within the JBrowse core project, a special
function `jbrequire` can provide your plugin access to these packages. Click
[here](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/ReExports/list.ts)
for a full list of packages accessible through `jbrequire`. Using `jbrequire`
might look like this:

```js
const { types } = pluginManager.jbrequire('mobx-state-tree')
```

which would provide the functionality of mobx-state-tree through that value.

Our final no-build plugin looks as follows:

`myplugin.js`

```js
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
        // upon clicking on this menu item, we need to add and show our new widget
        const widget = session.addWidget('CiteWidget', 'citeWidget', {
          view: self,
        })
        session.showWidget(widget)
      },
    })
  }
}
```

With JBrowse running and your plugin added to your config, your JBrowse session
should look like the following:

<Figure caption="Screenshot of a running JBrowse instance with the simple no build plugin added. Note our top level menu item has been added, and upon clicking it our widget opens." src="/img/no_build_final.png"/>

## Conclusion and next steps

Congratulations! You built and ran a single file no-build plugin in JBrowse.

If you'd like some general development information, checkout the series of
[developer guides](/docs/developer_guide) available.

Have some questions? [Contact us](/contact) through our various communication
channels.
