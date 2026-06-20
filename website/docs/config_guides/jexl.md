---
title: Using jexl callbacks
description: Dynamic configuration using jexl callback expressions
guide_category: Callbacks and customization
---

We use [Jexl](https://github.com/TomFrost/Jexl) for defining configuration
callbacks.

A Jexl configuration callback looks like this:

```json
    "color": "jexl:feature.strand==-1?'red':'blue'"
```

**Feature operations**

Read any feature attribute as a plain property, e.g. `feature.strand`. Nested
attributes work too (`feature.INFO.SVTYPE`), and `feature.parent` gives the
parent feature:

```js
jexl: feature.start // start coordinate, 0-based half open
jexl: feature.end // end coordinate, 0-based half open
jexl: feature.refName // chromosome or reference sequence name
jexl: feature.CIGAR // BAM or CRAM feature CIGAR string
jexl: feature.seq // BAM or CRAM feature sequence
jexl: feature.type // feature type e.g. mRNA or gene
jexl: feature.id // the feature's id attribute, e.g. a GFF3 ID=
jexl: feature.parent // parent feature, e.g. the gene of an mRNA (undefined if none)
```

:::note

The older `get(feature,'start')` function form is equivalent to `feature.start`
and still works, so existing configs need no changes. New configs can use
whichever reads more clearly.

:::

We have a number of other functions available in jexl, such as:

**Feature operations - getTag**

The getTag function smooths over slight differences in BAM and CRAM features to
access their tags

```js
jexl: getTag(feature, 'MD') // fetches MD string from BAM or CRAM feature
jexl: getTag(feature, 'HP') // fetches haplotype tag from BAM or CRAM feature
```

**String functions**

```js
jexl: charAt('abc', 2) // c
jexl: charCodeAt(' ', 0) // 32
jexl: codePointAt(' ', 0) // 32
jexl: startsWith('kittycat', 'kit') // true
jexl: endsWith('kittycat', 'cat') // true
jexl: padStart('cat', 8, 'kitty') // kittycat
jexl: padEnd('kitty', 8, 'cat') // kittycat
jexl: replace('kittycat', 'cat', '') // kitty
jexl: replaceAll('kittycatcat', 'cat', '') // kitty
jexl: slice('kittycat', 5) // cat
jexl: substring('kittycat', 0, 5) // kitty
jexl: trim('  kitty ') // kitty, whitespace trimmed
jexl: trimStart('  kitty ') // kitty, starting whitespace trimmed
jexl: trimEnd('  kitty ') // kitty, ending whitespace trimmed
jexl: toUpperCase('kitty') // KITTY
jexl: toLowerCase('KITTY') // kitty
jexl: split('KITTY KITTY', ' ') // ['KITTY', 'KITTY']
jexl: join('-', 'a', 'b', '', 'c') // a-b-c, joins truthy args with the separator
jexl: includes('kittycat', 'cat') // true
jexl: repeat('ab', 3) // ababab
jexl: jsonParse('{"a":1}') // parses a JSON string
```

**Math functions**

```js
jexl: max(0, 2)
jexl: min(0, 2)
jexl: sqrt(4)
jexl: ceil(0.5)
jexl: floor(0.5)
jexl: round(0.5)
jexl: abs(-0.5)
jexl: log10(50000)
jexl: parseInt('2')
jexl: parseFloat('2.054')
```

**Lookup tables**

Index an object literal by a feature attribute to map values to outputs. Types
not in the map return undefined, so pair it with `||` for a default:

```js
jexl: { mRNA: 'green', pseudogene: 'purple' }[feature.type] || 'gray'
```

**Console logging**

```js
jexl: log(feature) // console.logs output and returns value
```

**Binary operators**

```js
jexl: get(feature, 'flags') & 2 // bitwise and to check if BAM or CRAM feature flags has 2 set
```

**Template strings**

Our jexl fork supports JavaScript-style template literals with backticks and
`${...}` interpolation, which is often clearer than string concatenation. This
is handy for building colors — for example, an HSL color derived from a feature
value:

```json
"color": "jexl:`hsl(${get(feature,'start')/100000},50%,50%)`"
```

The equivalent with concatenation:

```json
"color": "jexl:'hsl('+get(feature,'start')/100000+',50%,50%)'"
```

### Making sophisticated color callbacks

For complex color callbacks, write a plugin that adds a function to the jexl
language and call it from your callback.

For example, create a file named "myplugin.js":

:::note

The example below uses the IIFE/`umdLoc` format. If you are using `esmLoc`, use
`export default class MyPlugin` instead (see
[customizing feature colors](/docs/config_guides/customizing_feature_colors) for
that pattern). `myplugin.js` doesn't need jbrowse-plugin-template as long as
it's self-contained and doesn't import other modules.

:::

```js
// myplugin.js
;(function () {
  class MyPlugin {
    install() {}
    configure(pluginManager) {
      pluginManager.jexl.addFunction('colorFeature', feature => {
        let type = feature.get('type')
        if (type === 'CDS') {
          return 'red'
        } else if (type === 'exon') {
          return 'green'
        } else {
          return 'purple'
        }
      })
    }
  }

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginMyPlugin = {
    default: MyPlugin,
  }
})()
```

Then put `myplugin.js` in the same folder as your config file, and then you can
use the custom `jexl` function in your config callbacks as follows:

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "umdLoc": { "uri": "myplugin.js" }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "my_track",
      "name": "my track",
      "assemblyNames": ["hg19"],
      "adapter": {
        "type": "Gff3Adapter",
        "gffLocation": {
          "uri": "volvox.filtered.gff"
        }
      },
      "displays": [
        {
          "type": "LinearBasicDisplay",
          "displayId": "mytrack-LinearBasicDisplay",
          "color": "jexl:colorFeature(feature)"
        }
      ]
    }
  ]
}
```

The feature in the callback is a "SimpleFeature" type object; read any attribute
as a property — `feature.start`, `feature.end`, `feature.refName`, or
`feature.other_attribute` for e.g. a field in a GFF3 column 9 (the equivalent
`feature.get('start')` method form also works).

See the [no-build plugin tutorial](/docs/developer_guides/no_build_plugin/) for
a full walkthrough of setting up a plugin like this.
