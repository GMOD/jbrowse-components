---
title: Installing plugins
description:
  The plugin store, Desktop's global plugins and config.json, and how long each
  install lasts
guide_category: General usage
---

Plugins add track types, view types, data adapters and menu items, and some
include data. How you install one, and how long it stays, depends on where you
run JBrowse.

The full catalog, each plugin with its config snippet, is on the
[plugin store page](/plugin_store). To write your own plugin, see the
[developer guide](/docs/developer_guide).

## Where are you running JBrowse?

- **A page someone else hosts**, such as genomes.jbrowse.org or a tutorial's
  link: [check whether it is already loaded](#is-it-already-loaded).
- **JBrowse Web in your browser**, for yourself:
  [the plugin store](#the-plugin-store).
- **A JBrowse Web site you run**, for every visitor:
  [config.json](#in-configjson).
- **JBrowse Desktop**: [Global plugins or the plugin store](#jbrowse-desktop).
- **A JBrowse component inside your own page**:
  [embedded components](#embedded-components).

## Is it already loaded?

A hosted config often loads the plugins its tutorials need. Open **Tools →
Plugin store**; **Installed plugins** at the top lists what this session loaded.

<Figure caption="Tools → Plugin store." src="/img/plugin_store.png" />

If the plugin is listed there, there is nothing to install; if not,
[install it](#the-plugin-store).

## The plugin store

Open **Tools → Plugin store**, type the plugin's name into **Filter plugins**
and click **Install**. JBrowse reloads with the plugin and keeps your views.

<Figure caption="The plugin store filtered to one plugin, with its Install button." src="/img/plugin_store_install.png" />

Some plugins (e.g. CIVIC) add their data when installed. Others register a new
track type or adapter, which needs a matching track config before it draws
anything.

**How long it lasts:** this session. A share link includes the plugin, but a new
session starts without it. For every visit,
[keep it](#keeping-a-plugin-for-every-visit).

Not in the store? [Load it by URL](#a-plugin-not-in-the-store).

### Keeping a plugin for every visit

Click the pin beside a plugin in **Installed plugins**, and JBrowse loads it
every time you open this config in this browser.

<Figure caption="A store plugin in the Installed plugins list, with the pin that keeps it for every visit." src="/img/plugin_store_keep.png" />

- The list is per configuration, not per site. A plugin kept on
  `jbrowse.org/code/jb2/main/?config=demos/hg002/config.json` does not load on
  another demo, or on another version of the app.
- JBrowse stores the list in this browser, so a session you share, or the same
  JBrowse opened on another machine, starts without these plugins.
- A kept plugin that did not load this visit (switched off, or skipped after a
  crash) is still a row in **Installed plugins**, with a switch beside it.
- On the [admin server](/docs/quickstart_adminserver) the store writes to
  `config.json` for every visitor instead, so the pin does not appear there.

JBrowse loads kept plugins before it draws anything, so a plugin that crashes on
load would crash the app on every visit. To recover:

- The fatal error dialog offers **Reload without permanent plugins**.
- If a load never finishes, JBrowse turns the stuck plugins off before the next
  visit. The plugin store then shows a banner naming them, with a switch per
  plugin and a **Turn back on and reload** button once the culprit is switched
  off.

Adding `?safeMode` to the URL skips every kept plugin for one load.

## JBrowse Desktop

Desktop has two routes:

- **Tools → Plugin store** inside a session works as in
  [JBrowse Web](#the-plugin-store). **How long it lasts:** as long as that
  session file; other sessions don't load it.
- **Global plugins...**, in the start screen's menu, installs a plugin for every
  session on this machine, from the next session you open.

<Figure caption="Global plugins from the start screen menu (1) opens the dialog, whose Add custom plugin (2) takes a UMD build's name and URL (3) or, under Advanced options, an ESM build's URL (4)." src="/img/desktop-global-plugins-steps.png" />

The dialog lists the store's plugins under **Available plugins**, each with an
**Install** button. If a plugin crashes on load, switch it off there to keep it
installed, or remove it. **Reload without global plugins**, in the same
start-screen menu, skips the whole list for one launch.

Not in the store? [Load it by URL](#a-plugin-not-in-the-store).

## A plugin that isn't in the store {#a-plugin-not-in-the-store}

Beta plugins often load by URL before they reach the store, and their tutorials
give the URL. Where you enter it depends on where you run JBrowse:

- **JBrowse Desktop**: **Add custom plugin**, in the
  [Global plugins dialog](#jbrowse-desktop) for every session, or in a session's
  plugin store for that session.
- **The admin server**: **Add custom plugin** in the plugin store, which writes
  it to `config.json`.
- **JBrowse Web, as a visitor**: there is no button. Ask the site's admin to add
  it to [`config.json`](#in-configjson), or open a session link whose
  [`sessionPlugins`](/docs/urlparams#loading-a-plugin-from-a-url) names it.

The **Add custom plugin** form asks for different fields for each build:

- **a UMD build** (a `.umd.js` file): **Plugin name** and **Plugin URL**
- **an ESM build**: open **Advanced options**, paste the URL into **ESM build
  URL**, and leave the rest empty

## In config.json

The top-level `plugins` array in `config.json` loads a plugin for everyone who
opens that config. A store plugin goes in by its store name (`storePlugin`) and
any other by its URL; [](/docs/config_guides/plugins) has the fields. The
`jbrowse` CLI has no plugin command, so edit the file by hand, or install from
the plugin store on the [admin server](/docs/quickstart_adminserver), which
writes the entry for you.

**How long it lasts:** until someone removes the entry.

## Embedded components

An embedded component takes its plugins as a prop; see
[](/docs/embedded_components) and the
[inline plugins example](https://jbrowse.org/storybook/lgv/inline-plugin/).

## How long each install lasts

| Where you install it                                        | Lasts                                            |
| ----------------------------------------------------------- | ------------------------------------------------ |
| Web plugin store                                            | this session, and is included in its share link  |
| Web plugin store, [kept](#keeping-a-plugin-for-every-visit) | every visit to this config, in this browser only |
| Web plugin store on the admin server                        | written to `config.json`, for every visitor      |
| Desktop plugin store                                        | the open session file                            |
| Desktop [Global plugins...](#jbrowse-desktop)               | every session on this machine                    |
| [`config.json`](#in-configjson)                             | every visitor to that config                     |

## See also

- [Plugin store page](/plugin_store)
- [](/docs/config_guides/plugins)
- [](/docs/developer_guide)
- [PLUGIN_LISTS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PLUGIN_LISTS.md)
