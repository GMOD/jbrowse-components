---
id: basechorddisplay
title: BaseChordDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/BaseChordDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BaseChordDisplay.md)

## Docs

### BaseChordDisplay - Identifier

#### slot: explicitIdentifier

### BaseChordDisplay - Slots

#### slot: onChordClick

```js
onChordClick: {
      type: 'boolean',
      description:
        'callback that should be run when a chord in the track is clicked',
      defaultValue: false,
      contextVariable: ['feature', 'track', 'pluginManager'],
    }
```
