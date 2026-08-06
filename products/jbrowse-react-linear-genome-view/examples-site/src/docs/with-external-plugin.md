Plugins load at runtime from a URL — the model JBrowse Web uses for
community-published plugins. `loadPlugins` fetches the bundles and returns one
`{ plugin, definition }` record each; hand those to `createViewState` as
`plugins`.

**Pass the records through unchanged** rather than mapping to `p.plugin`. The
`definition` is the plugin's URL, and that is what the
[RPC worker](../plugins/#with-web-worker) uses to load its own copy. Without it
the plugin is registered on the main thread only, and a track that needs it
fails inside the worker with an unknown-type error naming nothing about the real
cause.

`loadPlugins` is async, so run it in an effect and render the view once it
resolves. For plugins you author or `npm install`, pass the class directly — see
[inline plugins](../plugins/#with-inline-plugins). The
[plugin store](https://jbrowse.org/jb2/plugin_store/) lists what's published.
