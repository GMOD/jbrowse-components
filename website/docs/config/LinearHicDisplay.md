---
id: linearhicdisplay
title: LinearHicDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearHicDisplay.md)

## Docs

### LinearHicDisplay - Slots

#### slot: renderer

```js
renderer: pluginManager.getRendererType('HicRenderer')!.configSchema
```

#### slot: height

```js
height: {
        type: 'number',
        defaultValue: 300,
        description: 'default height for the Hi-C track',
      }
```

### LinearHicDisplay - Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
