---
title: Connections
description:
  Connection config for UCSC/JB2 track hubs and JBrowse 1 data directories, and
  how connections are stored in config vs. the session
guide_category: Core configuration
---

A **connection** points JBrowse at an external track hub or data directory and
makes its tracks available in the track selector without configuring each track
by hand. This guide covers the connection config format. For the in-app behavior
see the [Connections user guide](/docs/user_guides/connections).

## Where connections live

Connections come from two places, combined in the track selector:

- **`connections`**: a top-level array in your `config.json`, alongside
  `assemblies` and `tracks`. These are administrator-defined and available to
  everyone who loads the config.
- **Session connections**: connections a user adds at runtime (via `File` →
  `Open connection...`). These live in the saved session, not the admin config.

Both render identically as categories in the track selector.

## Connection config format

Every connection shares the base fields from
[BaseConnection](/docs/config/baseconnection):

- `type`: the connection type (e.g. `UCSCTrackHubConnection`)
- `connectionId`: a unique id for the connection
- `name`: a human-readable name, shown as the category label
- `assemblyNames`: optional list of assemblies the connection applies to, used
  to match hub tracks to the assemblies configured in your instance

Each type then adds its own location slot.

### UCSC track hub

Points at a hub's `hub.txt`. See
[UCSCTrackHubConnection](/docs/config/ucsctrackhubconnection).

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

Points at a JBrowse 2 config file. See
[JB2TrackHubConnection](/docs/config/jb2trackhubconnection) and
[loading from a config file](/docs/config_guides/from_config).

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

Points at a legacy JBrowse 1 data directory containing `trackList.json`. A
JBrowse 1 connection requires `assemblyNames`. See
[JBrowse1Connection](/docs/config/jbrowse1connection).

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

## Adding a connection with the CLI

```bash
jbrowse add-connection https://example.com/hub.txt \
  --type UCSCTrackHubConnection \
  --name "My Hub"
```

This appends a connection to the target `config.json`. See
[`jbrowse add-connection`](/docs/cli#jbrowse-add-connection) for all options.

## How connections are stored in a session

A connection config is just a pointer. It does not embed the hub's tracks. The
hub's track list is fetched when the connection is loaded (in the app, when its
category is expanded), and those track configs are held in memory only. They are
**not** written into the saved session.

The exception is a track you actually open: its config is stored in the session
(under `connectionTrackConfigs`), keyed by `trackId`, so it reopens instantly on
reload without re-fetching the whole hub. This keeps saved and shared sessions
small even when the connection points at a very large hub. Editing an open
connection track saves the change there as well.

## See also

- [Connections user guide](/docs/user_guides/connections)
- [BaseConnection](/docs/config/baseconnection)
- [Configuring tracks](/docs/config_guides/tracks)
- [Loading from a config file](/docs/config_guides/from_config)
