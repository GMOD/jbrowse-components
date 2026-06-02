---
title: Intro to the config.json format
description: Overall structure and key fields of the config.json file
guide_category: Getting started
---

The JBrowse 2 config file (typically `config.json`) is structured as follows:

```json
{
  "configuration": {
    /* global configs here */
  },
  "assemblies": [
    /* list of assembly configurations, e.g. the genomes being viewed */
  ],
  "tracks": [
    /* array of tracks being loaded; each references the assembly or assemblies
    it belongs to */
  ],
  "aggregateTextSearchAdapters": [
    /* optional array of text search adapters */
  ],
  "defaultSession": {
    /* optional default session */
  }
}
```

The most important things to configure are your assemblies and your tracks.

:::info

On jbrowse desktop, a "session" is a complete JBrowse config with a `.jbrowse`
file extension.

:::

:::info

Embedded components (e.g. `@jbrowse/react-linear-genome-view2`) take a config
object at runtime rather than a config file. To fetch one on the fly:

```typescript
const url = 'config.json'
const response = await fetch(url)
if (!response.ok) {
  throw new Error(`HTTP status ${response.status} fetching ${url}`)
}
const config = await response.json()
createViewState({
  ...config,
  assembly: config.assemblies[0], // only one assembly used in embedded currently
})
```

:::
