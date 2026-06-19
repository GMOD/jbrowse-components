JBrowse plugins extend the app with new track types, adapters, renderers, view
types, and menu items. The simplest pattern: define a `Plugin` subclass in your
own source and pass it directly to `createViewState` via the `plugins` option:

```js
import Plugin from '@jbrowse/core/Plugin'

class MyPlugin extends Plugin {
  name = 'MyPlugin'
  install(pluginManager) {
    /* add track types, extension points, etc. */
  }
  configure() {}
}

const state = createViewState({ config, plugins: [MyPlugin] })
```

This example registers a plugin that adds a "console.log the selected region"
item to the linear genome view's rubber-band menu — click and drag on the ruler
to see it. NPM-published plugins look identical from your app's perspective:
`import` the class and pass it the same way.

Plugins can also be [loaded from a URL](../with-external-plugin/) at runtime.
See the
[plugin development guide](https://jbrowse.org/jb2/docs/developer_guide/) for
authoring. Note: if you enable the [web worker RPC](../with-web-worker/),
plugins must be registered in **both** the main thread and the worker.
