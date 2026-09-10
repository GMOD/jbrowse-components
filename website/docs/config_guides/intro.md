---
title: config.json format
description: Overall structure and key fields of the config.json file
guide_category: Core configuration
---

**TL;DR:** you rarely write `config.json` by hand. The
[`@jbrowse/cli`](/docs/cli) commands (`jbrowse add-assembly`,
`jbrowse add-track`) write it for you. The two fields that matter are
[assemblies](/docs/config_guides/assemblies) and
[tracks](/docs/config_guides/tracks); everything else is optional.

```json
{
  "configuration": {/* global configs here */},
  "assemblies": [
    /* list of assembly configurations, e.g. the genomes being viewed */
  ],
  "tracks": [
    /* array of tracks being loaded, each references the assembly or assemblies
    it belongs to */
  ],
  "connections": [/* optional array of track hub connections */],
  "plugins": [/* optional array of plugins to load */],
  "internetAccounts": [/* optional array of authentication providers */],
  "aggregateTextSearchAdapters": [/* optional array of text search adapters */],
  "defaultSession": {/* optional default session */},
  "preConfiguredSessions": [/* optional array of named sessions */]
}
```

An entry in `assemblies` or `tracks` is a name and a file:
`{ "name": "hg38", "uri": "hg38.fa.gz" }` for an assembly and
`{ "trackId": "genes", "uri": "genes.gff.gz", "assemblyNames": ["hg38"] }` for a
track, with the adapter and track type read off the extension
([the shortest track](/docs/config_guides/tracks#the-shortest-track)). The
optional fields each have a guide:

| Field                         | Guide                                   |
| ----------------------------- | --------------------------------------- |
| `connections`                 | [](/docs/config_guides/connections)     |
| `plugins`                     | [](/docs/config_guides/plugins)         |
| `internetAccounts`            | [](/docs/config_guides/authentication)  |
| `aggregateTextSearchAdapters` | [](/docs/config_guides/text_searching)  |
| `defaultSession`              | [](/docs/config_guides/default_session) |
| `preConfiguredSessions`       | [](/docs/config_guides/default_session) |
| `configuration`               | [](/docs/config/jbrowseconfiguration)   |

Every slot of every track, display and adapter type is in the generated
[config reference](/docs/config), one page per type. On jbrowse-desktop a saved
session is this same format in a `.jbrowse` file, and embedded components take
the same object at runtime, with one assembly:
`createViewState({ ...config, assembly: config.assemblies[0] })`.

## Checking a config with jbrowse validate

**JBrowse silently ignores a config key it does not recognize.** The track still
appears, so the only symptom of a misspelled setting, or one written in an older
JBrowse version's format, is a color, height or filter that does nothing.
[`jbrowse validate`](/docs/cli#jbrowse-validate) checks for exactly this,
against the slot definitions read out of JBrowse itself, without opening any
data file:

```bash
jbrowse validate myconfig.json
```

```
error: tracks[0].assemblyNames: assembly "hg19" is not defined in this config — did you mean "hg38"?
error: tracks[0].adapter.bamLocatoin: unknown slot "bamLocatoin" — did you mean "bamLocation"? — JBrowse ignores keys it does not declare, so this setting silently does nothing
error: defaultSession.views[0].tracks[0]: trackId "sample_bem" is not defined in this config — did you mean "sample_bam"?

3 error(s), 0 warning(s) in myconfig.json
```

It exits non-zero on errors (`--json` for machine-readable output), so it can
gate a deploy; see [](/docs/agents) if an AI assistant is writing the config.

## The schema, in an editor

The same checks are published as a JSON Schema at
`https://jbrowse.org/jb2/schema/v5/config.json`, generated from JBrowse's own
type registry. A `$schema` line at the top of the file is all an editor needs to
complete type names, slot names and enum members, show each slot's description
and default on hover, and underline a key JBrowse would drop:

```json
{
  "$schema": "https://jbrowse.org/jb2/schema/v5/config.json",
  "assemblies": [{ "name": "hg38", "uri": "hg38.fa.gz" }],
  "tracks": [
    { "trackId": "genes", "uri": "genes.gff.gz", "assemblyNames": ["hg38"] }
  ]
}
```

`v5` is the JBrowse major version the schema describes; the file regenerates
with each release. `jbrowse validate` runs the schema first and adds what a
schema cannot see — a `trackId` a session names that no track defines, an
assembly no `assemblies` entry defines — so the two agree on every slot. A type
a plugin registers is not in the schema and passes with its keys unchecked; a
`frozen` slot such as the alignments display's `colorBy` is any JSON value, and
its description says what it takes. A session spec written on its own, the
`views[]` entry a `&session=spec-` URL carries, validates against `#/$defs/View`
inside the same file.

## See also

- [](/docs/automating)
- [Configuring assemblies](/docs/config_guides/assemblies)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/config_guides/deploying)
- [`@jbrowse/cli` command reference](/docs/cli)
