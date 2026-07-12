---
title: Plugin store
description: Installing community plugins
guide_category: Other features
---

The in-app plugin store lets you browse, search, and install community plugins
into the current session. Plugins can add new track types, view types, data
adapters, custom menu items, and more.

To write your own plugin, see the [developer guide](/docs/developer_guide).

Where the install persists depends on the context:

- web session - saved into the session and travels with the share link
- admin server - written to `config.json`, persists across sessions
- JBrowse Desktop - saved into the open session file

Some plugins (e.g. CIVIC) add their data automatically when installed. Others
only register building blocks (a new track type, a new adapter) that need a
matching config entry to be useful. Ask an admin if you can't edit the config
yourself.

<Figure caption="The plugin store inside the app." src="/img/plugin_store.png" />

## See also

- [Developer guide](/docs/developer_guide) - writing your own plugin
- [Plugin configuration](/docs/config_guides/plugins) - adding plugins to a
  config file
