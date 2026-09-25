---
title: Plugins
description: Adding first- and third-party plugins via config.json
guide_category: Core configuration
---

In jbrowse-web and jbrowse-desktop, add a plugin by listing its `name` (which
must match the name the plugin registers itself under) and bundle `url` in the
top-level `plugins` array.

```json
{
  "plugins": [
    {
      "name": "GDC",
      "url": "https://unpkg.com/jbrowse-plugin-gdc/dist/jbrowse-plugin-gdc.umd.production.min.js"
    },
    {
      "name": "MyPlugin",
      "esmLoc": { "uri": "plugin.js" }
    }
  ]
}
```

- **`name` must match the plugin's own registration** (`name = 'GDC'` in the
  plugin class), or the plugin fails to load.
- **The [plugin store](/plugin_store/) lists unpkg URLs** for published plugins,
  which you can also download to your own server. Plugin authors submit a PR to
  [jbrowse-plugin-list](https://github.com/GMOD/jbrowse-plugin-list).
- **Embedded components load plugins inline**; see the
  [inline plugins example](https://jbrowse.org/storybook/lgv/plugins/#with-inline-plugins).

`url` is the simplest field and equals `umdUrl`. The others differ in module
format and in what the path resolves against:

| Field    | Module format | Path resolved relative to |
| -------- | ------------- | ------------------------- |
| `url`    | UMD           | index.html                |
| `umdUrl` | UMD           | index.html                |
| `umdLoc` | UMD           | config.json               |
| `esmUrl` | ESM           | index.html                |
| `esmLoc` | ESM           | config.json               |

`umdLoc`/`esmLoc` suit a plugin file that lives beside config.json. UMD is what
the plugin store publishes and the only format an RPC worker can load, so it is
the format to reach for unless you are loading a plugin you build yourself.

The `cjsUrl` field is gone as of v5. It loaded a plugin by writing it to a temp
file and `require`ing it in jbrowse-desktop's renderer, which nothing needed:
Electron's renderer runs both other formats, and a plugin reaching the main
process does it through `window.require('electron')` whichever format it ships
in. A config still naming one fails that plugin by name and opens without it.

<Figure src="/img/plugin_store.png" caption="Opening the plugin store from the Tools menu. Plugins installed via the config (here UMDUrlPlugin) show a lock icon in the Installed plugins section, and the GUI cannot remove them. The Available plugins list below offers one-click installs."/>

## See also

- [](/docs/user_guides/plugin_store)
- [](/docs/developer_guide/)
- [No-build plugin](/docs/developer_guides/no_build_plugin)
- [Simple plugin tutorial](/docs/developer_guides/simple_plugin)
