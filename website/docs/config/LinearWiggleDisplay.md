---
id: linearwiggledisplay
title: LinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearWiggleDisplay.md)

## Docs

configuration for the wiggle (quantitative/numeric) display showing XY plot,
density, line, or scatter renderings

### LinearWiggleDisplay - Slots

#### slot: defaultRendering

```js
defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering type', [
        'xyplot',
        'density',
        'line',
        'scatter',
      ]),
      defaultValue: 'xyplot',
      description: 'Default rendering type',
    }
```

#### slot: height

```js
height: {
      type: 'number',
      defaultValue: 100,
      description: 'Default height of the track',
    }
```

#### slot: color

```js
color: {
      type: 'color',
      defaultValue: WIGGLE_COLOR_DEFAULT,
      description: 'Color for the wiggle bars',
    }
```

#### slot: summaryScoreMode

```js
summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    }
```
