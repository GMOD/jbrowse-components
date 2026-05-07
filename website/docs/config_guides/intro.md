---
id: intro
title: Intro to the config.json format
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
    /* array of tracks being loaded, contain reference to which assembl(y/ies)
    they belong to */
  ],
  "aggregateTextSearchAdapters": [
    /* optional array of text search adapters */
  ],
  "defaultSession": {
    /* optional default session */
  }
}
```

The most important thing to configure are your assemblies and your tracks.

:::info

On jbrowse desktop, a "session" is a complete JBrowse config with a `.jbrowse`
file extension.

:::

:::info

Embedded components (e.g. `@jbrowse/react-linear-genome-view`) take a config
object at runtime rather than a config file. To fetch one on the fly:

```typescript
const response = await fetch('config.json')
if (!response.ok) {
  throw new Error(`HTTP status ${response.status} fetching ${url}`)
}
const config = await response.json()
createViewState({
  ...config,
  assembly: config.assemblies[0], // only one assembly used in embedded currently)
})
```

:::
