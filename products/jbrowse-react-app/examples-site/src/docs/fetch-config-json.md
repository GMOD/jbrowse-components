Unlike JBrowse Web, the embedded app does not load a config's `plugins`: hand
them to `loadPlugins`, whose `baseUri` resolves a relative plugin URL against
the config rather than your page.
