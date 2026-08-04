Plugins can be loaded at runtime from a URL. This is the model JBrowse Web uses
for community-published plugins. Fetch the bundle(s) with `loadPlugins`, which
returns one `{ plugin, definition }` record each, then hand those records to
`createViewState` via the normal `plugins` option:

```js
import { createViewState, loadPlugins } from '@jbrowse/react-app2'

const plugins = await loadPlugins([
  {
    name: 'UCSC',
    url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
  },
])

const state = createViewState({ config, plugins })
```

Pass the records through unchanged rather than mapping them to `p.plugin`. The
`definition` on each one is the plugin's URL, and that is what the
[RPC worker](../customizing-the-app/#with-web-worker) uses to load its own copy
— without it the plugin is registered on the main thread only.

`loadPlugins` takes the same entries a JBrowse Web `config.json` lists under
`plugins`, so a [fetched config](../loading-config/#with-fetch-config-json) is
just `loadPlugins(config.plugins ?? [], { baseUri: configUrl })` — pass
`baseUri` so a relative plugin url resolves against the config rather than
against your app. Unlike JBrowse Web, the embedded app never fetches them for
you: `createViewState` is synchronous and loading a plugin is not. Because of
that, run `loadPlugins` in an effect and render the app only once the state
resolves.

This example loads the UCSC plugin from unpkg and shows a `UCSCAdapter` track on
hg19. For plugins you author or `npm install` yourself, pass the class directly.
See [embedded plugins](../plugins/#embedded-plugin). The
[plugin store](https://jbrowse.org/jb2/plugin_store/) lists published plugins.
