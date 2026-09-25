---
title: Plugins
description: Adding first- and third-party plugins via config.json
guide_category: Core configuration
---

In jbrowse-web and jbrowse-desktop, the top-level `plugins` array says what to
load. A published plugin is named by its plugin-store entry; a plugin you host
yourself is named by its url.

```json
{
  "plugins": [
    { "storePlugin": "MsaView" },
    {
      "name": "MyPlugin",
      "url": "https://example.com/plugins/myplugin.umd.js"
    },
    {
      "name": "MyLocalPlugin",
      "umdLoc": { "uri": "myplugin.umd.js" }
    }
  ]
}
```

- **`storePlugin` is the name the [plugin store](/plugin_store/) lists it
  under.** JBrowse resolves it against the store when the config loads, picking
  a build published for the version of JBrowse doing the reading and checking
  its integrity hash. Nothing in the config pins a url or a version, which is
  what makes it the form to use in a config that will be read for years — a
  permanent url, a track hub. Plugin authors submit a PR to
  [jbrowse-plugin-list](https://github.com/GMOD/jbrowse-plugin-list) to be
  listed.
- **`name` must match the plugin's own registration** (`name = 'MyPlugin'` in
  the plugin class) for a UMD build, which is looked up by that name once its
  script has run. An ESM build carries its own, and a store entry supplies one.
- **Embedded components load plugins inline**; see the
  [inline plugins example](https://jbrowse.org/storybook/lgv/plugins/#with-inline-plugins).

## Naming a build directly

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

Add `integrity` beside a UMD url to have the browser check the bytes against the
hash before running them; the store publishes one per build.

A url is an answer computed on the day the config was written, which is what
`storePlugin` exists to avoid. The two can ride together — the ref for a JBrowse
that resolves it, the url for one that does not, and as the fallback when the
store cannot be reached:

```json
{
  "plugins": [
    {
      "storePlugin": "MsaView",
      "name": "MsaView",
      "url": "https://jbrowse.org/plugins/jbrowse-plugin-msaview/latest/dist/jbrowse-plugin-msaview.umd.production.min.js"
    }
  ]
}
```

## The retired `cjsUrl`

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
