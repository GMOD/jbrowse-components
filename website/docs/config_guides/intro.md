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

The JBrowse 2 config file (typically `config.json`) is structured as follows:

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

`assemblies` and `tracks` carry the data, and an entry in either is a name and a
file: `{ "name": "hg38", "uri": "hg38.fa.gz" }` for an
[assembly](/docs/config_guides/assemblies), and
`{ "trackId": "genes", "uri": "genes.gff.gz", "assemblyNames": ["hg38"] }` for a
track. A config with one assembly supplies `assemblyNames` itself (see
[the shortest track](/docs/config_guides/tracks#the-shortest-track)). The
adapter and track type come from the extension.

Every other top-level field is optional:

| Field                         | Guide                                   |
| ----------------------------- | --------------------------------------- |
| `connections`                 | [](/docs/config_guides/connections)     |
| `plugins`                     | [](/docs/config_guides/plugins)         |
| `internetAccounts`            | [](/docs/config_guides/authentication)  |
| `aggregateTextSearchAdapters` | [](/docs/config_guides/text_searching)  |
| `defaultSession`              | [](/docs/config_guides/default_session) |
| `preConfiguredSessions`       | [](/docs/config_guides/default_session) |
| `configuration`               | [](/docs/config/jbrowseconfiguration)   |

These guides cover the common cases. Every option for a track or adapter type is
in the generated [config reference](/docs/config_guide), one page per type, e.g.
[](/docs/config/bamadapter) or [](/docs/config/linearwiggledisplay). For many
tracks, [](/docs/config_guides/deploying) generates `config.json` from a script.

On jbrowse-desktop, saved `.jbrowse` sessions use this same format.

## Checking a config with jbrowse validate

**A config key JBrowse does not recognize is ignored rather than reported.** The
track still appears, so the only symptom of a misspelled setting is that your
color, height or filter does nothing. `jbrowse validate` catches this:

```bash
jbrowse validate myconfig.json
```

```
error: tracks[0].assemblyNames: assembly "hg19" is not defined in this config — did you mean "hg38"?
error: tracks[0].adapter.bamLocatoin: unknown slot "bamLocatoin" — did you mean "bamLocation"? — JBrowse ignores keys it does not declare, so this setting silently does nothing
error: defaultSession.views[0].tracks[0]: trackId "sample_bem" is not defined in this config — did you mean "sample_bam"?

3 error(s), 0 warning(s) in myconfig.json
```

It checks against slot definitions read out of JBrowse itself and never opens
your data files. Two levels:

- **error** — JBrowse accepts it and silently does the wrong thing: an unknown
  slot, a key a `defaultSession` view or display does not declare, a track
  naming an undefined assembly, a `defaultSession` naming a missing `trackId`, a
  duplicate `trackId`
- **warning** — JBrowse reports or handles it itself on load: a type name it
  does not know (expected when a plugin registers it), or a legacy key a
  migration rewrites

`--json` gives machine-readable output, and a non-zero exit on errors can gate a
deploy. See [](/docs/agents) if an AI assistant is writing the config.

Embedded components (e.g. `@jbrowse/react-linear-genome-view2`) take the config
as an object at runtime (see
[embedding a linear genome view](/docs/tutorials/embed_linear_genome_view)):

```typescript
const url = 'config.json'
const response = await fetch(url)
if (!response.ok) {
  throw new Error(`HTTP status ${response.status} fetching ${url}`)
}
const config = await response.json()
createViewState({
  ...config,
  assembly: config.assemblies[0], // the embedded LGV takes a single assembly
})
```

## See also

- [](/docs/config_and_session_json)
- [Configuring assemblies](/docs/config_guides/assemblies)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/config_guides/deploying)
- [`@jbrowse/cli` command reference](/docs/cli)
