---
id: linearpairedarcdisplay
title: LinearPairedArcDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/arc/src/LinearPairedArcDisplay/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearPairedArcDisplay/configSchema.ts)

### LinearPairedArcDisplay - Slots

#### slot: color

```js
color: {
        type: 'color',
        description: 'the color of the arcs',
        defaultValue: 'jexl:defaultPairedArcColor(feature,alt)',
        contextVariable: ['feature', 'alt'],
      }
```

### LinearPairedArcDisplay - Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
