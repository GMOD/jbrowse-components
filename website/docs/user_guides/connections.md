---
title: Connections
description: UCSC track hubs, JB2 track hubs, and JBrowse 1 data directories
guide_category: General usage
---

A **connection** is a reusable pointer to an external track hub or data
directory. Instead of configuring each track by hand, you point JBrowse at a hub
once and its tracks become available in the track selector.

JBrowse supports three built-in connection types:

- **UCSC Track Hub** — any
  [UCSC Genome Browser track hub](https://genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html)
  reachable over the network
- **JB2 Track Hub** — a track hub based on a
  [JBrowse 2 config file](/docs/config_guides/from_config)
- **JBrowse 1 data directory** — a legacy JBrowse 1 data directory with a
  `trackList.json`

## Connections in the track selector

Every connection appears as its own **category** in the track selector, listed
below your regular tracks and named after the connection.

A connection is loaded **lazily**: expanding its category is what fetches the
hub's track list. This keeps large hubs (which can contain thousands of tracks)
out of the way until you actually want them, and means you no longer have to
"turn on" each connection separately — just expand it to browse.

Once expanded, the connection's tracks appear underneath it and you open them
with their checkboxes like any other track.

Because loading only happens on expand, adding several connections is cheap.
Expand the one you want when you want it; leave the rest collapsed.

## Opening a connection

Use the menu bar: `File` → `Open connection...`, or the track selector's
hamburger menu → `Connections...` → `Add connection...`

A form asks for the connection URL and type. Paste the hub URL (see below for
the format), choose the connection type, and submit. A newly added connection is
loaded right away, so its tracks appear immediately.

## Connections and saved sessions

When you open a track from a connection, that track is remembered in your
session. After a page reload the track reopens immediately — with no need to
re-fetch the whole hub. The connection's category is shown collapsed; expand it
again whenever you want to browse the rest of its tracks.

Only the tracks you actually opened are stored in the session, so sharing or
saving a session that uses a connection stays lightweight even when the
underlying hub is huge.

## Removing a connection

Open the track selector's hamburger menu → `Connections...` →
`Delete connections...` and choose the connection to remove.

## UCSC track hub URL format

The URL must point directly to the `hub.txt` file of the hub, for example:

```
https://hgdownload.soe.ucsc.edu/hubs/GCA/009/914/755/GCA_009914755.4/hub.txt
```

Public hubs are listed in the
[UCSC Public Hub directory](https://genome.ucsc.edu/cgi-bin/hgHubConnect). Each
hub listed there has a "URL" column — paste that URL into the connection form.

JBrowse matches hub tracks to assemblies by genome ID. If the hub targets an
assembly not already configured in your JBrowse instance, those tracks will not
appear. You can filter by assembly name in the connection form.

## JBrowse 1 connection URL format

For the legacy JBrowse 1 connection type, point the URL at the JBrowse 1 data
directory containing `trackList.json` (e.g. `https://myhost/jbrowse1/data/`) and
supply the assembly name it corresponds to. See the
[JBrowse1Connection config docs](/docs/config/jbrowse1connection) for details.

## Adding a connection via the CLI

```bash
# UCSC track hub
jbrowse add-connection https://example.com/hub.txt \
  --type UCSCTrackHubConnection \
  --name "My Hub"

# JBrowse 1 data directory
jbrowse add-connection https://myhost/jbrowse1/data/ \
  --type JBrowse1Connection \
  --assemblyNames hg19 \
  --name "JBrowse 1 data"
```

See `jbrowse add-connection --help` or the
[CLI reference](/docs/cli#jbrowse-add-connection) for all options.

## See also

- [Configuring connections](/docs/config_guides/connections) — the connection
  config format and how connections are stored in config vs. the session
- [Basic usage: opening tracks](/docs/user_guides/basic_usage#opening-tracks) —
  opening individual tracks and connections from the menu
- [Plugin store](/docs/user_guides/plugin_store) — add new connection and
  adapter types
- [Text searching configuration](/docs/config_guides/text_searching) — indexing
  feature names for the search box
- [Live demos: full instances and hubs](/demos/#instances) — a UCSC GenArk hub
  imported live in the app, plus a full multi-track demo instance
