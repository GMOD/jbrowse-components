---
id: basechorddisplay
title: BaseChordDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/circular-view/src/BaseChordDisplay/models/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/BaseChordDisplay/models/configSchema.ts)

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
