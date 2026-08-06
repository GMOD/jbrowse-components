Plugins load at runtime from a URL — the model JBrowse Web uses for
community-published plugins. `loadPlugins` fetches the bundles and returns one
`{ plugin, definition }` record each, which go to `createViewState` as
`plugins`. This demo loads the UCSC plugin from unpkg and shows a `UCSCAdapter`
track on hg19.

**Pass the records through unchanged** rather than mapping to `p.plugin`: the
`definition` is the plugin's URL, and that is what the
[RPC worker](../customizing-the-app/#with-web-worker) uses to load its own copy.

`loadPlugins` takes the same entries a JBrowse Web `config.json` lists under
`plugins`, so a [fetched config](../loading-config/#with-fetch-config-json) is
just `loadPlugins(config.plugins ?? [], { baseUri: configUrl })` — pass
`baseUri` so a relative plugin URL resolves against the config rather than your
app. Unlike JBrowse Web, the embedded app never fetches them for you:
`createViewState` is synchronous and loading a plugin is not, so run
`loadPlugins` in an effect and render once it resolves.

For plugins you author or `npm install`, pass the class directly — see
[embedded plugins](../plugins/#embedded-plugin). The
[plugin store](https://jbrowse.org/jb2/plugin_store/) lists what's published.
