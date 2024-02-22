---
id: lineargenomeviewconfigschema
title: LinearGenomeViewConfigSchema
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/linear-genome-view/src/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/index.ts)

### LinearGenomeViewConfigSchema - Slots

#### slot: configuration.LinearGenomeViewPlugin.trackLabels

```js
trackLabels: {
      type: 'string',
      defaultValue: 'overlapping',
      model: types.enumeration('trackLabelOptions', [
        'offset',
        'overlapping',
        'hidden',
      ]),
    }
```
