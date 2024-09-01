---
id: jexl
title: Using jexl callbacks
---

We use [Jexl](https://github.com/TomFrost/Jexl) for defining configuration
callbacks.

An example of a Jexl configuration callback might look like this:

```json
    "color": "jexl:get(feature,'strand')==-1?'red':'blue'"
```

The notation `get(feature,'strand')` is the same as `feature.get('strand')` in
javascript code.

We have a number of functions available in jexl, such as:

**Feature operations - get**

```js
jexl: get(feature, 'start') // start coordinate, 0-based half open
jexl: get(feature, 'end') // end coordinate, 0-based half open
jexl: get(feature, 'refName') // chromosome or reference sequence name
jexl: get(feature, 'CIGAR') // BAM or CRAM feature CIGAR string
jexl: get(feature, 'seq') // BAM or CRAM feature sequence
jexl: get(feature, 'type') // feature type e.g. mRNA or gene
```

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

**Console logging**

```js
jexl: log(feature) // console.logs output and returns value
jexl: cast({ mRNA: 'green', pseudogene: 'purple' })[get(feature, 'type')] // returns either green or purple depending on feature type
```

**Binary operators**

```js
jexl: get(feature, 'flags') & 2 // bitwise and to check if BAM or CRAM feature flags has 2 set
```

### Making sophisticated color callbacks

If you have a color callback that has a lot of logic in it, then using jexl to
express all that logic may be hard. Instead, you can make a small plugin which
adds a function to the jexl language, and call that function in your jexl
callback.

For example, create a file named "myplugin.js" (see also Footnote 1)

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
        "type": "Gff3TabixAdapter",
        "gffLocation": {
          "uri": "volvox.filtered.gff"
        }
      },
      "displays": [
        {
          "type": "LinearBasicDisplay",
          "displayId": "mytrack-LinearBasicDisplay",
          "renderer": {
            "type": "SvgFeatureRenderer",
            "color1": "jexl:colorFeature(feature)"
          }
        }
      ]
    }
  ]
}
```

The feature in the callback is a "SimpleFeature" type object, and you can call
`feature.get('start')`, `feature.get('end')`, `feature.get('refName')`, or
`feature.get('other_attribute')` for e.g. maybe a field in a GFF3 column 9

Footnote 0. See
[our no-build plugin tutorial](/docs/tutorials/no_build_plugin_tutorial/) for
more info on setting up a simple plugin for doing these customizations.

Footnote 1. `myplugin.js` does not have to use the jbrowse-plugin-template if it
is small and self contained like this, and does not import other modules. if you
import other modules from your plugin, then it can be worth it to use the
jbrowse-plugin-template.

Footnote 2. if you are using embedded, there are also other methods of including
plugins, see
https://jbrowse.org/storybook/lgv/main/?path=/story/using-plugins--page
