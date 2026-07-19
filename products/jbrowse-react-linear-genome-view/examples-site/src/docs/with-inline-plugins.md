JBrowse plugins extend the embedded view with new track types, adapters,
renderers, view types, and menu items. They're passed to `createViewState` as
the `plugins` option and integrated into the view's plugin manager at startup.

The simplest pattern: define a `Plugin` subclass in your own source and pass it
directly. This example registers a plugin that adds a "console.log the selected
region" action to the rubber-band menu.

```js
const state = createViewState({
  assembly,
  tracks,
  plugins: [MyInlinePlugin],
  location: 'ctgA:1105..1221',
})
```

NPM-installed plugins look identical from your app's perspective. `import` the
class and pass it the same way. Plugins can also be
[loaded from a URL](../plugins/#with-external-plugin) at runtime. See the
[plugin development guide](https://jbrowse.org/jb2/docs/developer_guide/) for
authoring. Note: if you enable the
[web worker RPC](../plugins/#with-web-worker), plugins must be registered in
**both** the main thread and the worker.
