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
      type: 'color',
      description:
        'the color of each feature in a synteny, used with colorBy:default',
      defaultValue: '#f0f',
      contextVariable: ['feature'],
    }
```

#### slot: posColor

```js
posColor: {
      type: 'color',
      description: 'the color for forward alignments, used with colorBy:strand',
      defaultValue: 'blue',
    }
```

#### slot: negColor

```js
negColor: {
      type: 'color',
      description: 'the color for reverse alignments, used with colorBy:strand',
      defaultValue: 'red',
    }
```

#### slot: lineWidth

```js
lineWidth: {
      type: 'number',
      description: 'width of the lines to be drawn',
      defaultValue: 2.5,
    }
```

#### slot: colorBy

```js
colorBy: {
      type: 'stringEnum',
      model: types.enumeration('colorBy', [
        'identity',
        'meanQueryIdentity',
        'mappingQuality',
        'strand',
        'default',
      ]),
      description: `Color by options:<br/>
<ul>
  <li>"identity" - the identity of the particular hit, similar to D-GENIES, use the other config slots 'thresholds' and 'thresholdsPalette' to define colors for this setting</li>
  <li>"meanQueryIdentity" - calculates the weighted mean identity (weighted by alignment length) of all the hits that the query maps to (e.g. if the query is split aligned to many target, uses their weighted mean. can help show patterns of more related and distant synteny after WGD)</li>
  <li>"mappingQuality" - uses mapping quality from PAF, some adapters don't have this setting</li>
  <li>"strand" - colors negative alignments with negColor and positive alignments with posColor</li>
  <li>"default" - uses the 'color' config slot</li>
</ul>`,
      defaultValue: 'default',
    }
```

#### slot: thresholdsPalette

```js
thresholdsPalette: {
      type: 'stringArray',
      defaultValue: ['#094b09', '#2ebd40', '#d5670b', '#ffd84b'],
      description: 'threshold colors, used with colorBy:identity',
    }
```

#### slot: thresholds

```js
thresholds: {
      type: 'stringArray',
      defaultValue: ['0.75', '0.5', '0.25', '0'],
      description: 'threshold breakpoints, used with colorBy:identity',
    }
```
