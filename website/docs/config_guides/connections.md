---
title: Connections
description:
  Connection config for UCSC/JB2 track hubs and JBrowse 1 data directories, and
  how connections are stored in config vs. the session
guide_category: Core configuration
---

**TL;DR:** a connection makes an external hub's tracks available in the track
selector without configuring each track by hand. Admin-defined connections go in
the top-level `connections` array; connections a user adds at runtime live in
their session. This guide covers the config format; for in-app behavior see the
[Connections user guide](/docs/user_guides/connections).

## Connection config format

Every connection carries the [BaseConnection](/docs/config/baseconnection) slots
(`type`, `connectionId`, `name`, and an optional `assemblyNames` that matches
hub tracks to your configured assemblies), plus one location slot per type.
`jbrowse add-connection` writes one from the command line
([CLI reference](/docs/cli#jbrowse-add-connection)).

### UCSC track hub

Points at a hub's `hub.txt`
([UCSCTrackHubConnection](/docs/config/ucsctrackhubconnection)):

```json
{
  "type": "UCSCTrackHubConnection",
  "connectionId": "ucsc_example",
  "name": "UCSC example hub",
  "hubTxtLocation": {
    "uri": "https://example.com/hub.txt"
  }
}
```

### JB2 track hub

Points at another JBrowse 2 `config.json`, whose `tracks` array becomes the
connection's track list
([JB2TrackHubConnection](/docs/config/jb2trackhubconnection)):

```json
{
  "type": "JB2TrackHubConnection",
  "connectionId": "jb2_example",
  "name": "JB2 example hub",
  "configJsonLocation": {
    "uri": "https://example.com/config.json"
  }
}
```

### JBrowse 1 data directory

Points at a JBrowse 1 data directory holding `trackList.json` and `tracks.conf`,
either of which may be absent, and translates its tracks on connect. A JBrowse 1
connection serves one assembly, so `assemblyNames` is required and holds a
single entry ([JBrowse1Connection](/docs/config/jbrowse1connection)):

```json
{
  "type": "JBrowse1Connection",
  "connectionId": "jb1_example",
  "name": "JBrowse 1 data",
  "assemblyNames": ["hg19"],
  "dataDirLocation": {
    "uri": "https://example.com/jbrowse1/data/"
  }
}
```

#### Migrating a JBrowse 1 instance

[This gist](https://gist.github.com/cmdcolin/2ef875fc19c5f164aad41bd330f1bb37)
converts a directory once: it reads `trackList.json` and `tracks.conf`, follows
their `include`s, and writes the tracks into a JBrowse 2 `config.json` using the
same table as
[`jb1ToJb2.ts`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/jb1ToJb2.ts).
An unrecognized `storeClass` is matched on the filename, and a format with no
JBrowse 2 equivalent leaves a placeholder track naming it. Check the result with
`jbrowse validate config.json`.

## How connections are stored in a session

<!-- GOTCHA BaseConnection START -->

:::caution Gotcha

A connection config is only a pointer: the hub's track list is fetched when the
connection loads and held in memory, and is **not** written into a saved or
shared session. Only a track you actually open is stored (under
`connectionTrackConfigs`, keyed by `trackId`), which is what keeps a shared
session small even against a very large hub.

:::

<!-- GOTCHA BaseConnection END -->

## See also

- [Connections user guide](/docs/user_guides/connections)
- [](/docs/config/baseconnection)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/config_guides/track_selector)
