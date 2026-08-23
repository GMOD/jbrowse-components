---
title: Plugins
description: Adding first- and third-party plugins via config.json
guide_category: Core configuration
---

**TL;DR:** in jbrowse-web and jbrowse-desktop, add a plugin by listing its
`name` (which must match the name the plugin registers itself under) and bundle
`url` in the top-level `plugins` array.

Embedded components load plugins inline; see the
[inline plugins example](https://jbrowse.org/storybook/lgv/plugins/#with-inline-plugins).

```json
{
  "plugins": [
    {
      "name": "GDC",
      "url": "https://unpkg.com/jbrowse-plugin-gdc/dist/jbrowse-plugin-gdc.umd.production.min.js"
    }
  ]
}
```

The `name` must match the name the plugin registers itself under in its source
(e.g. `name = 'GDC'` in the plugin class), or the plugin fails to load. The
`url` (or one of the location fields below) points at the built plugin bundle.
The [plugin store](/plugin_store/) lists unpkg URLs for published plugins, which
you can also download to your own server.

`url` is the simplest option and is equivalent to `umdUrl`. Other fields cover
different situations:

| Field    | Module format | Path resolved relative to |
| -------- | ------------- | ------------------------- |
| `url`    | UMD           | index.html                |
| `umdUrl` | UMD           | index.html                |
| `umdLoc` | UMD           | config.json               |
| `esmUrl` | ESM           | index.html                |
| `esmLoc` | ESM           | config.json               |
| `cjsUrl` | CJS           | index.html (desktop only) |

Which one to reach for:

- `umdLoc` or `esmLoc` when your plugin file lives alongside your config.json
- `esmUrl`/`esmLoc` for a pure ESM module
- `cjsUrl` for jbrowse-desktop, since Electron does not support ESM and the
  jbrowse-plugin-template outputs CJS-specific code for desktop

## umdLoc example

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "umdLoc": { "uri": "plugin.js" }
    }
  ]
}
```

## esmUrl example

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "esmUrl": "https://unpkg.com/my-plugin/dist/index.mjs"
    }
  ]
}
```

## Plugin store

Plugin authors can submit their plugin via PR to
[jbrowse-plugin-list](https://github.com/GMOD/jbrowse-plugin-list).

You can verify the plugin is installed properly by checking the Plugin Store:

<Figure src="/img/plugin_store.png" caption="Opening the plugin store from the Tools menu. Plugins installed via the config (here UMDUrlPlugin) show a lock icon in the Installed plugins section, indicating they cannot be removed through the GUI. The Available plugins list below offers one-click installs."/>

See our [developer guide](/docs/developer_guide/) for developing plugins, or the
[plugins page](/plugin_store) for published plugins.

## See also

- [](/docs/user_guides/plugin_store)
- [No-build plugin](/docs/developer_guides/no_build_plugin)
- [Simple plugin tutorial](/docs/developer_guides/simple_plugin)
