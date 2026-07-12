---
title: config.json format
description: Overall structure and key fields of the config.json file
guide_category: Getting started
---

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
  "aggregateTextSearchAdapters": [/* optional array of text search adapters */],
  "defaultSession": {/* optional default session */}
}
```

The most important things to configure are your
[assemblies](/docs/config_guides/assemblies) and your
[tracks](/docs/config_guides/tracks). The optional top-level fields are
`aggregateTextSearchAdapters` (see
[text searching](/docs/config_guides/text_searching)) and `defaultSession` (see
[default session](/docs/config_guides/default_session)).

Looking for the complete list of options for a specific track or adapter type?
The auto-generated [config reference](/docs/config_guide) has one page per type,
generated directly from the source code (so it never goes stale), e.g.
[BamAdapter](/docs/config/bamadapter) or
[LinearWiggleDisplay](/docs/config/linearwiggledisplay). The hand-written guides
explain the common cases. The reference is the exhaustive master list.

You rarely need to write `config.json` by hand. The [`@jbrowse/cli`](/docs/cli)
commands (`jbrowse add-assembly`, `jbrowse add-track`) write the JSON for you,
and for repetitive data you can
[generate `config.json` from a script](/docs/config_guides/deploying). See
[Deploying JBrowse Web](/docs/config_guides/deploying) for an end-to-end
scripted setup.

On jbrowse-desktop, saved sessions use this same config format, stored in a file
with a `.jbrowse` extension.

Embedded components (e.g. `@jbrowse/react-linear-genome-view2`) take a config
object at runtime rather than a config file (see
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

- [Configuring assemblies](/docs/config_guides/assemblies), the first thing
  every config.json needs
- [Configuring tracks](/docs/config_guides/tracks), the second thing every
  config.json needs
- [Deploying JBrowse Web](/docs/config_guides/deploying), scripting config.json
  instead of hand-writing it
- [`@jbrowse/cli` command reference](/docs/cli), `add-assembly`/`add-track`
  generate this file for you
