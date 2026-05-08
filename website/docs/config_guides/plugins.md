---
id: plugins
title: Configuring plugins
---

In jbrowse-web and jbrowse-desktop, plugins are added via `config.json`.
Embedded components use a different approach — see the
[storybook example](https://jbrowse.org/storybook/lgv/main/?path=/story/using-plugins--page).

External plugins can be added to the config.json file like so:

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

Our plugin store lists unpkg URLs for published plugins at
https://jbrowse.org/jb2/plugin_store/. You can also download plugin files from
those URLs to your own server.

The `url` field shown above is the simplest option and is equivalent to
`umdUrl`. There are additional fields available for different situations:

| Field    | Module format | Path resolved relative to |
| -------- | ------------- | ------------------------- |
| `url`    | UMD           | index.html                |
| `umdUrl` | UMD           | index.html                |
| `umdLoc` | UMD           | config.json               |
| `esmUrl` | ESM           | index.html                |
| `esmLoc` | ESM           | config.json               |
| `cjsUrl` | CJS           | index.html (desktop only) |

Use `umdLoc` or `esmLoc` when your plugin file lives alongside your config.json
rather than at the app root. Use `esmUrl`/`esmLoc` for a pure ESM module. Use
`cjsUrl` for jbrowse-desktop, since Electron does not support ESM and the
jbrowse-plugin-template outputs CJS-specific code for desktop.

#### umdLoc example

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

#### esmUrl example

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

### Plugin store

Plugin authors can submit their plugin via PR to
[jbrowse-plugin-list](https://github.com/GMOD/jbrowse-plugin-list).

You can verify the plugin is installed properly by checking the Plugin Store:

<Figure src="/img/plugin-store.png" caption="Example screenshot showing how installed plugins are represented in the plugin store interface. Plugins installed via the config are shown with a lock icon, indicating they cannot be removed via the GUI."/>

See our [developer guide](/docs/developer_guide/) for more information on
developing plugins, or our [plugins page](/plugin_store) to browse currently
published plugins.
