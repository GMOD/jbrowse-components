---
title: Plugin store
description: Installing community plugins
guide_category: Other features
---

The in-app plugin store installs community plugins into the current session.
Plugins can add new track types, view types, data adapters, custom menu items,
and more.

You can browse and search the available plugins, which are drawn from the public
plugin store. To write your own plugin, see the
[developer guide](/docs/developer_guide).

Where the install persists depends on the context:

- **web session** — saved into the session and travels with the share link
- **admin server** — written to `config.json`, persists across sessions
- **JBrowse Desktop** — saved into the open session file

Some plugins (e.g. CIVIC) add their data automatically when installed. Others
only register building blocks (a new track type, a new adapter) that need a
matching config entry to be useful — ask an admin if you can't edit the config
yourself.

<Figure caption="The plugin store inside the app." src="/img/plugin_store.png" />
