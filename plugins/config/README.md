# @jbrowse/plugin-config

JBrowse 2 config utilities

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### registerConfigAdapters

Registers `FromConfigAdapter`, whose features a track config writes inline,
and the alias adapters an assembly's `refNameAliases` reads through, on a
plugin manager that wants them without the configuration editor, as a
headless host does.

```js
// type signature
(pluginManager: PluginManager) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/adapters.ts)

<!-- API_DOCS_END -->
