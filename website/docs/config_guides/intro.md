---
id: intro
title: Intro to the config.json format
---

A JBrowse 2 configuration for jbrowse-web is stored in a file (often called
config.json) and is structured as follows

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

Note: On jbrowse desktop, a "session" refers to a config.json with a .jbrowse
file extension

:::

:::info

Note: with embedded components e.g. @jbrowse/react-linear-genome-view, it does
not accept a config file but rather an object at runtime with the config loaded.

To fetch a config.json object on the fly in @jbrowse/react-linear-genome-view,
you might use something like this:

```js
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
