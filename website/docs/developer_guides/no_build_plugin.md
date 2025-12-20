---
id: no_build_plugin
title: Writing a no-build plugin
toplevel: true
---

import Figure from '../figure'

The following guide will provide a short tutorial on how to create a single page
no-build plugin for JBrowse 2.

## Pre-requisites

- you can run an instance of JBrowse 2 on the web, see
  [any of our quickstart guides](/docs/quickstart_web) for details
- a stable and recent version of [node](https://nodejs.org/en/)
- basic familiarity with the command line and navigating the file system

## What is the difference between a no-build plugin and a "regular" plugin?

A "regular" JBrowse plugin often uses our plugin template
https://github.com/GMOD/jbrowse-plugin-template which uses `rollup` to compile
extra dependencies that your plugin might use.

In contrast, "no-build" plugins have no build step and can be hand edited. This
can be useful for adding
[extra jexl config callbacks for making extra config callbacks or similar modifications](/docs/config_guides/customizing_feature_colors/).

## Writing a "no-build" plugin

### Example use case: Adding a jexl callback function which you can use in your config

A common method for a no-build plugin might be making a custom function that you
can use to simplify `jexl` callbacks in your config. We will create a file
`myplugin.js`, which will export a single class.

`myplugin.js`

```typescript
export default class MyPlugin {
  name = 'MyPlugin'
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
```

Put this file `myplugin.js` in the same folder as your config file, and then,
you can refer to this plugin and the custom function you added in your
`config.json`.

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "esmLoc": {
        "uri": "myplugin.js"
      }
    }
  ],
  "tracks": []
}
```

### Example use case: Adding a global menu item

Another example of a no-build plugin is to add menu items or minor extension
points. Here, we're going to add a menu item using the `configure` method in the
plugin class.

`myplugin.js`

```typescript
export default class MyPlugin {
  name = 'MyPlugin'
  version = '1.0'
  install() {}
  configure(pluginManager) {
    // this is called in the web worker as well, which does not have a
    // rootModel, so check for existence of pluginManager.rootModel before
    // continuing
    if (pluginManager.rootModel) {
      // adding a new menu to the top toolbar
      pluginManager.rootModel.insertMenu('Citations', 4)

      // appending a menu item to the new menu
      pluginManager.rootModel.appendToMenu('Citations', {
        label: 'Cite this JBrowse session',
        onClick: session => {
          /* do nothing for now, see below for example */
        },
      })
    }
  }
}
```

### Importing with jbrequire

Because our plugin is not going to be built with any dependencies, the process
for referencing external libraries is a little different.

If a package you need to use is found within the JBrowse core project, a special
function `jbrequire` can provide your plugin access to these packages. Click
[here](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/ReExports/list.ts)
for a full list of packages accessible through `jbrequire`. Using `jbrequire`
might look like this:

```typescript
const { types } = pluginManager.jbrequire('@jbrowse/mobx-state-tree')
```

This would provide the functionality of @jbrowse/mobx-state-tree through that
value.

## Complete example

Example

`esmplugin.js`

```typescript
export default class MyPlugin {
  name = 'MyPlugin'
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
    const { types } = pluginManager.jbrequire('@jbrowse/mobx-state-tree')

    const React = pluginManager.jbrequire('react')

    // this is our react component
    const CiteWidget = props => {
      // React.createElement can be used to add html to our widget component.
      // We write out raw React.createElement code because JSX requires a build
      // step and can't be used very easily in the no build plugin context
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
    if (pluginManager.rootModel) {
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
}
```

Then in your config you can reference it using the "esmLoc" function

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "esmLoc": {
        "uri": "esmplugin.js"
      }
    }
  ],
  "tracks": []
}
```

## Result

With JBrowse running and the "Citation" plugin from above added to your config,
your JBrowse session should look like the following:

<Figure caption="Screenshot of a running JBrowse instance with the simple no build plugin added. Note our top level menu item has been added, and upon clicking it our widget opens." src="/img/no_build_final.png"/>

## Conclusion and next steps

Congratulations! You built and ran a single file no-build plugin in JBrowse.

Have some questions? [Contact us](/contact) through our various communication
channels.

## Footnote 1: JSX syntax

You can see from the above that writing React code is a little cumbersome as JSX
syntax is not really supported in the no build plugins since JSX generally
requires a build step.

If you are writing module code or writing a plugin that has dependencies, you
can try our https://github.com/GMOD/jbrowse-plugin-template which has a build
step, bundler, and type checking with typescript

## Footnote 2: UMD vs ESM module syntax

This guide was updated in 2024 to use "ESM" modules which export a simple class
in response to browsers increased support of importing pure ESM modules.
However, for maximum legacy browser compatibility, you can also use "UMD"
modules also

For an example of UMD, see
https://github.com/GMOD/jbrowse-components/blob/76ce3660c9192f071d23e2478c756fff42ec533a/test_data/volvox/umd_plugin.js#L1-L127
(it uses a function that defines a specific global variable rather than
exporting a class)
