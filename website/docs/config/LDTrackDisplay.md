---
id: ldtrackdisplay
title: LDTrackDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/configSchema2.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LDTrackDisplay.md)

## Docs

Display configuration for pre-computed LD data on LDTrack extends

- [SharedLDDisplay](../sharedlddisplay)

### LDTrackDisplay - Slots

#### slot: renderer

LDRenderer

```js
renderer: configSchema
```

#### slot: height

```js
height: {
        type: 'number',
        defaultValue: 400,
      }
```

### LDTrackDisplay - Derives from

```js
baseConfiguration: sharedLDConfigFactory()
```
