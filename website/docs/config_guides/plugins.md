---
id: plugins
title: Configuring plugins
---

import Figure from '../figure'

In jbrowse-web and jbrowse-desktop, plugins can be added using the config.json.
Note that with our embedded components, you will likely use a different method
than described in this article: see
https://jbrowse.org/storybook/lgv/main/?path=/story/using-plugins--page

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

Our plugin store lists the URLs for unpkg URLs for these plugins
https://jbrowse.org/jb2/plugin_store/. You can also download the plugin files
from e.g. the unpkg URLs to your local server and serve them.

There are several other ways to plugins in the config, that have particular ways
of being resolved from your local server.

#### umdUrl

```json
{
  "plugins": [
    {
      "name": "GDC",
      "umdUrl": "https://unpkg.com/jbrowse-plugin-gdc/dist/jbrowse-plugin-gdc.umd.production.min.js"
    }
  ]
}
```

`umdUrl` is resolved relative to the index.html of the file, so can be a
relative path in your root directory or an absolute URL to somewhere on the web

#### umdLoc

```json
{
  "plugins": [
    {
      "name": "GDC",
      "umdLoc": { "uri": "plugin.js" }
    }
  ]
}
```

`umdLoc` is resolved relative to the config.json that is being loaded, so is
helpful for storing the plugin.js in the same folder as your config

#### esmUrl

```json
{
  "plugins": [
    {
      "name": "GDC",
      "umdLoc": { "uri": "http://unpkg.com/path/to/esm/module.js" }
    }
  ]
}
```

`esmUrl` is resolved relative to the index.html of the file, so can be a
relative path in your root directory or an absolute URL to somewhere on the web.
Note that ESM modules are currently not supported in web workers in firefox, so
you can use MainThreadRpc, or use alternative module formats like UMD for broad
compatibility.

#### esmLoc

```json
{
  "plugins": [
    {
      "name": "GDC",
      "esmLoc": { "uri": "module.js" }
    }
  ]
}
```

`esmLoc` is resolved relative to the config.json that is being loaded, so is
helpful for storing the plugin.js in the same folder as your config. Note that
ESM modules are currently not supported in web workers in firefox, so you can
use MainThreadRpc, or use alternative module formats like UMD for broad
compatibility.

#### cjsUrl

```json
{
  "plugins": [
    {
      "name": "GDC",
      "cjsUrl": "http://unpkg.com/path/to/cjs/module.js"
    }
  ]
}
```

`cjsUrl` is used for desktop plugins specifically, since Electron (as of
writing) does not support ESM, and since the jbrowse-plugin-template will not
output some code that is helpful for desktop like true require() calls for
desktop modules. See the
[desktop plugin tutorial](/docs/tutorials/desktop_spec_plugin_tutorial/) for
more info.

### Plugin store

We recommend developers that create plugins add their plugins to our plugin
store: https://github.com/GMOD/jbrowse-plugin-list you can create a PR to add
your plugin there.

You can verify the plugin is installed properly by checking the Plugin Store:

<Figure src="/img/plugin-store.png" caption="Example screenshot showing how installed plugins are represented in the plugin store interface. Plugins installed via the config are shown with a lock icon, indicating they cannot be removed via the GUI."/>

See our [developer guide](/docs/developer_guide/) for more information on
developing plugins, or our [plugins page](/plugin_store) to browse currently
published plugins.
