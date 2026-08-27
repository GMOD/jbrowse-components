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

`assemblies` and `tracks` are the two that carry data, and an entry in either is
a name and a file: `{ "name": "hg38", "uri": "hg38.fa.gz" }` for an assembly
(see [assemblies](/docs/config_guides/assemblies)), and for a track
`{ "trackId": "genes", "uri": "genes.gff.gz", "assemblyNames": ["hg38"] }`,
whose `assemblyNames` a config with one assembly supplies (see
[the shortest track](/docs/config_guides/tracks#the-shortest-track)). JBrowse
reads the adapter, and a track's type, off the extension.

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

These hand-written guides explain the common cases. Every option for a specific
track or adapter type is in the auto-generated
[config reference](/docs/config_guide), one page per type generated from source,
e.g. [](/docs/config/bamadapter) or [](/docs/config/linearwiggledisplay).

For repetitive data, [](/docs/config_guides/deploying) covers generating
`config.json` from a script, end to end.

On jbrowse-desktop, saved sessions use this same config format, stored in a file
with a `.jbrowse` extension.

## Checking a config with jbrowse validate

**A config key JBrowse does not recognize is ignored rather than reported.** The
track still appears, so the only symptom of a misspelled setting, or one written
in a format from an older JBrowse version, is that your color, height or filter
does nothing.

`jbrowse validate` checks for exactly this:

```bash
jbrowse validate myconfig.json
```

```
error: tracks[0].assemblyNames: assembly "hg19" is not defined in this config — did you mean "hg38"?
error: tracks[0].adapter.bamLocatoin: unknown slot "bamLocatoin" — did you mean "bamLocation"? — JBrowse ignores keys it does not declare, so this setting silently does nothing
error: defaultSession.views[0].init.tracks[0]: trackId "sample_bem" is not defined in this config — did you mean "sample_bam"?

3 error(s), 0 warning(s) in myconfig.json
```

It checks against config-slot definitions read out of JBrowse itself, so it
knows every track, display and adapter type and the slots each accepts, and it
never opens your data files, so it runs before anything is uploaded. Two levels:

- **error** — JBrowse accepts it and silently does the wrong thing: an unknown
  slot, a track pointing at an assembly the config never defines, a
  `defaultSession` naming a `trackId` that does not exist, a duplicate
  `trackId`.
- **warning** — JBrowse will tell you itself on load, or handles it: a type name
  it does not know (which is expected if a plugin registers it), or a legacy key
  a migration rewrites.

Add `--json` for machine-readable output; it exits non-zero when there are
errors, so it can gate a deploy. See [](/docs/agents) if an AI assistant is
writing the config.

Embedded components (e.g. `@jbrowse/react-linear-genome-view2`) take a config
object at runtime (see
[embedding a linear genome view](/docs/tutorials/embed_linear_genome_view)). To
fetch one on the fly:

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
