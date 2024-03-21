---
id: dotplotrenderer
title: DotplotRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/dotplot-view/src/DotplotRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotRenderer/configSchema.ts)

### DotplotRenderer - Slots

#### slot: color

```js
color: {
      contextVariable: ['feature'],
      defaultValue: '#f0f',
      description:
        'the color of each feature in a synteny, used with colorBy:default',
      type: 'color',
    }
```

#### slot: colorBy

```js
colorBy: {
      defaultValue: 'default',
      description: `Color by options:<br/>
<ul>
  <li>"identity" - the identity of the particular hit, similar to D-GENIES, use the other config slots 'thresholds' and 'thresholdsPalette' to define colors for this setting</li>
  <li>"meanQueryIdentity" - calculates the weighted mean identity (weighted by alignment length) of all the hits that the query maps to (e.g. if the query is split aligned to many target, uses their weighted mean. can help show patterns of more related and distant synteny after WGD)</li>
  <li>"mappingQuality" - uses mapping quality from PAF, some adapters don't have this setting</li>
  <li>"strand" - colors negative alignments with negColor and positive alignments with posColor</li>
  <li>"default" - uses the 'color' config slot</li>
</ul>`,
      model: types.enumeration('colorBy', [
        'identity',
        'meanQueryIdentity',
        'mappingQuality',
        'strand',
        'default',
      ]),
      type: 'stringEnum',
    }
```

#### slot: lineWidth

```js
lineWidth: {
      defaultValue: 2.5,
      description: 'width of the lines to be drawn',
      type: 'number',
    }
```

#### slot: negColor

```js
negColor: {
      defaultValue: 'red',
      description: 'the color for reverse alignments, used with colorBy:strand',
      type: 'color',
    }
```

#### slot: posColor

```js
posColor: {
      defaultValue: 'blue',
      description: 'the color for forward alignments, used with colorBy:strand',
      type: 'color',
    }
```

#### slot: thresholds

```js
thresholds: {
      defaultValue: ['0.75', '0.5', '0.25', '0'],
      description: 'threshold breakpoints, used with colorBy:identity',
      type: 'stringArray',
    }
```

#### slot: thresholdsPalette

```js
thresholdsPalette: {
      defaultValue: ['#094b09', '#2ebd40', '#d5670b', '#ffd84b'],
      description: 'threshold colors, used with colorBy:identity',
      type: 'stringArray',
    }
```
