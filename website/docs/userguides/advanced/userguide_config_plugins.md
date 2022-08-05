---
id: userguide_config_plugins
title: Configuring plugins
toplevel: true
---

import Figure from '../../figure'

External published plugins can be added to the configuration like so:

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

Published plugins are typically hosted on unpkg and can be referenced as above.

Any tools that are available via that plugin will then be added to JBrowse. You can verify the plugin is installed properly by checking the Plugin Store:

<Figure src="/img/plugin-store.png" caption="Example screenshot showing how installed plugins are represented in the plugin store interface. Plugins installed via the config are shown with a lock icon, indicating they cannot be removed via the GUI."/>

If you have an unpublished plugin running locally, you can add that plugin to your configuration using the localhost the plugin is running on:

```json
{
  "plugins": [
    {
      "name": "GDC",
      "url": "http://localhost:9000/dist/jbrowse-plugin-gdc.umd.development.js"
    }
  ]
}
```

Checkout our [developer guides](/docs/developer_guide/) for more information on developing plugins, or our [plugins page](/plugins) to browse currently published plugins.
