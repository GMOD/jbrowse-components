Plugins can be loaded at runtime from a URL. This is the model JBrowse Web uses
for community-published plugins. Fetch the bundle(s) with `loadPlugins`, which
returns one `{ plugin, definition }` record each, then hand those records to
`createViewState` via the normal `plugins` option:

```js
import {
  createViewState,
  loadPlugins,
} from '@jbrowse/react-linear-genome-view2'

const plugins = await loadPlugins([
  {
    name: 'UCSC',
    url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
  },
])

const state = createViewState({
  assembly,
  tracks,
  plugins,
})
```

Pass the records through unchanged rather than mapping them to `p.plugin`. The
`definition` on each one is the plugin's URL, and that is what the
[RPC worker](../plugins/#with-web-worker) uses to load its own copy — without it
the plugin is registered on the main thread only, and a track that needs it
fails inside the worker with an unknown-type error that names nothing about the
real cause.

Because `loadPlugins` is async, run it in an effect and render the view only
once the state resolves. For plugins you author or `npm install` yourself, pass
the class directly. See [inline plugins](../plugins/#with-inline-plugins). The
[plugin store](https://jbrowse.org/jb2/plugin_store/) lists published plugins.
