---
title: Connections
description: UCSC track hubs, JB2 track hubs, and JBrowse 1 data directories
guide_category: General usage
---

A **connection** is a reusable pointer to an external track hub or data
directory. Once opened, JBrowse fetches the hub's track list automatically and
adds those tracks to the track selector, so you don't have to configure each
track individually. Closing a connection removes all of its tracks.

JBrowse supports three built-in connection types:

- **UCSC Track Hub** — any
  [UCSC Genome Browser track hub](https://genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html)
  reachable over the network
- **JB2 Track Hub** — a track hub based on a JBrowse 2 config file
- **JBrowse 1 data directory** — a legacy JBrowse 1 data directory with a
  `trackList.json`

## Opening a connection via the UI

Use the menu bar: `File` → `Open connection...`

A form asks for the connection URL and type. Paste the hub URL (see below for
the format), choose the connection type, and click Submit.

Tracks from the connection will appear in the track selector under a category
named after the connection.

## UCSC track hub URL format

The URL must point directly to the `hub.txt` file of the hub, for example:

```
https://hgdownload.soe.ucsc.edu/hubs/GCA/009/914/755/GCA_009914755.4/hub.txt
```

Public hubs are listed in the
[UCSC Public Hub directory](https://genome.ucsc.edu/cgi-bin/hgHubConnect). Each
hub listed there has a "URL" column — paste that URL into the connection form.

:::info Assembly names

JBrowse matches hub tracks to assemblies by genome ID. If the hub targets an
assembly not already configured in your JBrowse instance, those tracks will not
appear. You can filter by assembly name in the connection form.

:::

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
