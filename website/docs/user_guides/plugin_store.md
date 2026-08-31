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

## Keeping a plugin for every visit

A plugin installed in a web session goes when the session does: a new session,
or someone else's link, starts without it. The pin beside a plugin in the
**Installed plugins** list keeps it instead, so that JBrowse loads it every time
you open it in this browser.

- The list is per configuration, not per site. A plugin kept on
  `jbrowse.org/code/jb2/main/?config=demos/hg002/config.json` does not load on
  another demo, or on another version of the app.
- It lives in this browser and nowhere else. A session you share carries none of
  it, and neither does the same JBrowse opened on another machine.
- **Tools → Permanent plugins...** is the list itself, where one can be switched
  off without being removed, or taken out for good.
- An admin editing `config.json` is installing for every visitor instead, so the
  pin does not appear in admin mode.

Because these load before anything is on screen, a plugin that crashes on load
would otherwise take the app down on every visit with no way back to the menu.
Two things stop that:

- The fatal error dialog offers **Reload without permanent plugins**.
- A load that never finishes turns them off by itself next time, and says which
  ones were loading. **Tools → Permanent plugins...** turns them back on once
  the culprit is switched off.

Adding `?safeMode` to the URL does the same thing deliberately, and accuses
nobody.

## See also

- [Plugin store page](/plugin_store)
- [](/docs/developer_guide)
- [Plugin configuration](/docs/config_guides/plugins)
- [PLUGIN_LISTS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PLUGIN_LISTS.md)
  — the four lists a plugin can be in, the two that outlive a session (Desktop's
  global list and jbrowse-web's per-config permanent list), the crash marker
  behind both safe modes, and why installing one rebuilds the whole app
