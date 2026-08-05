---
title: Writing a no-build plugin
description:
  Plugin without a build step, useful for jexl callbacks and simple
  modifications
guide_category: Getting started
---

**TL;DR:** a no-build plugin is a single hand-edited `.js` file next to your
`config.json`, referenced from the `plugins` array with `esmLoc`. It needs no
bundler and no npm install, which makes it the right shape for
[jexl config callbacks or similar modifications](/docs/config_guides/customizing_feature_colors/)
— at the cost of no JSX, no TypeScript, and no dependencies beyond what JBrowse
re-exports.

A "regular" plugin uses the
[plugin template](https://github.com/GMOD/jbrowse-plugin-template) and bundles
dependencies with `rollup`. The only prerequisite here is a running JBrowse 2
instance to load the file into (see
[any of our quickstart guides](/docs/quickstart_web)).

## Adding a jexl callback

Register a custom jexl function to simplify config callbacks in `myplugin.js`:

```js
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

Put `myplugin.js` alongside your config file and reference it in `config.json`:

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

## Adding a global menu item

This adds a menu item via the plugin's `configure` method:

<!-- include: test_data/no_build_plugin/esmplugin.js#configure -->

```js
configure(pluginManager) {
  // configure runs in the web worker too, and there is no rootModel there —
  // so guard on it before touching any menu
  if (pluginManager.rootModel) {
    // a new menu in the top toolbar, at index 4
    pluginManager.rootModel.insertMenu('Citations', 4)

    pluginManager.rootModel.appendToMenu('Citations', {
      label: 'Cite this JBrowse session',
      onClick: session => {
        const widget = session.addWidget('CiteWidget', 'citeWidget', {})
        session.showWidget(widget)
      },
    })
  }
}
```

## Importing with jbrequire

With no build step, use `jbrequire` to access the shared libraries JBrowse
re-exports (React, MobX, MST, MUI, and `@jbrowse/core` APIs). See
[](/docs/developer_guides/imports_and_reexports) and the
[canonical list](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ReExports/list.ts).

```js
const { types } = pluginManager.jbrequire('@jbrowse/mobx-state-tree')
```

## Complete example

`esmplugin.js`

<!-- include: test_data/no_build_plugin/esmplugin.js -->

```js
// The "Complete example" no-build plugin from
// website/docs/developer_guides/no_build_plugin.md, hosted so the tutorial's
// result figure (no_build_final) can be generated automatically instead of
// hand-captured.
//
// That guide's code fences are GENERATED FROM THIS FILE (`<!-- include: -->`),
// so editing here edits the published guide — run `pnpm sync-doc-snippets`
// after, and write comments for guide readers. The `// #region` marker is
// load-bearing.
export default class MyPlugin {
  name = 'MyPlugin'
  version = '1.0'

  install(pluginManager) {
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

    const CiteWidget = () => {
      // React.createElement rather than JSX: JSX needs a build step, which is
      // the one thing a no-build plugin does not have.
      const header = React.createElement(
        'h1',
        null,
        'Cite this JBrowse session',
      )
      const content = React.createElement(
        'p',
        null,
        'Diesh, Colin, et al. "JBrowse 2: a modular genome browser with views of synteny and structural variation." Genome Biology 24, 74 (2023).',
      )

      return React.createElement('div', null, header, content)
    }

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'CiteWidget',
        heading: 'Cite this JBrowse session',
        configSchema: ConfigurationSchema('CiteWidget', {}),
        stateModel: types.model('CiteWidget', {
          id: ElementId,
          type: types.literal('CiteWidget'),
        }),
        ReactComponent: CiteWidget,
      })
    })
  }

  configure(pluginManager) {
    // configure runs in the web worker too, and there is no rootModel there —
    // so guard on it before touching any menu
    if (pluginManager.rootModel) {
      // a new menu in the top toolbar, at index 4
      pluginManager.rootModel.insertMenu('Citations', 4)

      pluginManager.rootModel.appendToMenu('Citations', {
        label: 'Cite this JBrowse session',
        onClick: session => {
          const widget = session.addWidget('CiteWidget', 'citeWidget', {})
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

## Note: JSX syntax

React without JSX is more verbose since JSX needs a build step. If your plugin
has dependencies or you prefer TypeScript, use the
[plugin template](https://github.com/GMOD/jbrowse-plugin-template), which
includes a bundler and type checking.

## Note: UMD vs ESM module syntax

This guide uses ESM modules (a plain exported class), supported by all modern
browsers. For legacy browsers you can use UMD modules instead. See
[this example](https://github.com/GMOD/jbrowse-components/blob/76ce3660c9192f071d23e2478c756fff42ec533a/test_data/volvox/umd_plugin.js#L1-L127),
which defines a global variable rather than exporting a class.

## Note: Plugins in embedded React components

This guide targets jbrowse-web, which loads plugins via `config.json`. Embedded
components (`@jbrowse/react-app2` or `@jbrowse/react-linear-genome-view2`)
instead pass the plugin class in the `plugins` array to `createViewState`:

```js
import { createViewState, JBrowseApp } from '@jbrowse/react-app2'

class MyPlugin {
  name = 'MyPlugin'
  install(pluginManager) {
    /* ... */
  }
  configure() {}
}

const state = createViewState({ config, plugins: [MyPlugin] })
```

See the
[With external plugin](https://jbrowse.org/storybook/app/with-external-plugin/)
example in the `@jbrowse/react-app2` examples site for a live example.

## See also

- [](/docs/developer_guides/simple_plugin)
- [](/docs/developer_guides/pluggable_elements)
- [](/docs/developer_guides/creating_widget)
