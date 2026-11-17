---
title: Connections
description: UCSC track hubs, JB2 track hubs, and JBrowse 1 data directories
guide_category: General usage
---

A **connection** is a reusable pointer to an external track hub or data
directory. Point JBrowse at a hub once and its tracks become available in the
track selector.

JBrowse supports three built-in connection types:

- **UCSC Track Hub:** any
  [UCSC Genome Browser track hub](https://genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html)
  reachable over the network
- **JB2 Track Hub:** a track hub based on a
  [JBrowse 2 config file](/docs/config_guides/from_config)
- **JBrowse 1 data directory:** a legacy JBrowse 1 data directory with a
  `trackList.json`

## Connections in the track selector

Every connection appears as a separate **category** in the track selector,
listed below your regular tracks and named after the connection.

A connection is loaded **lazily**: expanding its category fetches the hub's
track list, and its tracks open with their checkboxes like any other track.
JBrowse fetches nothing for a collapsed connection, so adding several is cheap.

## Opening a connection

Open the form from either route:

- **File → Open connection...** in the menu bar
- **Connections → Add connection...** in the track selector's hamburger menu

Paste the hub URL ([format below](#ucsc-track-hub-url-format)), choose the
connection type, and submit. A newly added connection loads right away.

## Connections and saved sessions

The session stores the tracks you opened from a connection, and only those, so
after a reload they reopen without re-fetching the hub, and a shared session
stays small however large the hub is. The connection's category shows collapsed;
expand it again to browse the rest.

## Removing a connection

**Connections → Delete connections...** in the track selector's hamburger menu
lists the connections to remove.

## UCSC track hub URL format

The URL must point directly to the `hub.txt` file of the hub, for example:

```text
https://hgdownload.soe.ucsc.edu/hubs/GCA/009/914/755/GCA_009914755.4/hub.txt
```

Public hubs are listed in the
[UCSC Public Hub directory](https://genome.ucsc.edu/cgi-bin/hgHubConnect); paste
the URL from its "URL" column into the connection form.

JBrowse matches hub tracks to assemblies by genome ID, so a track appears only
when its assembly is configured in your JBrowse instance. The connection form
can filter by assembly name.

A composite track's subgroups, such as cell line, antibody or view, become
columns and filters in the track table, named as the hub titles them. The rest
of each track's trackDb settings are under `ucsc` in its About dialog.

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

- [](/docs/user_guides/hub_url)
- [Configuring connections](/docs/config_guides/connections)
- [Basic usage: opening tracks](/docs/user_guides/basic_usage#opening-tracks)
- [](/docs/user_guides/plugin_store)
- [Text searching configuration](/docs/config_guides/text_searching)
