Pass the records `loadPlugins` returns through unchanged. The RPC worker loads
its own copy from each record's `definition`, so mapping to `p.plugin` leaves
the plugin on the main thread only. The
[plugin store](https://jbrowse.org/jb2/plugin_store/) lists published plugins.
