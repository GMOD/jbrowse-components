---
id: config
title: config
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## registerConfigAdapters

Registers `FromConfigAdapter`, whose features a track config writes inline,
and the alias adapters an assembly's `refNameAliases` reads through, on a
plugin manager that wants them without the configuration editor, as a
headless host does.

```js
// type signature
(pluginManager: PluginManager) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/adapters.ts)
