---
title: Plugin store
description: Installing community plugins
guide_category: General usage
---

**TL;DR:** The in-app plugin store lets you browse, search, and install
community plugins into the current session. Plugins can add new track types,
view types, data adapters, and custom menu items, and some carry their own data
with them.

The full catalog of white-listed plugins, each with its config snippet, is also
listed on the [plugin store page](/plugin_store).

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

- [Plugin store page](/plugin_store)
- [](/docs/developer_guide)
- [Plugin configuration](/docs/config_guides/plugins)
- [PLUGIN_INSTALL_RESTART.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PLUGIN_INSTALL_RESTART.md)
  — why installing one rebuilds the whole app, and which of the two plugin lists
  an edit goes into
- [GLOBAL_PLUGINS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GLOBAL_PLUGINS.md)
  — Desktop's global list, and the crash marker behind safe mode: when it arms,
  and what clears it
