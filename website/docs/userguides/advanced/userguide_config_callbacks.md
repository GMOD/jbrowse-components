---
id: userguide_config_callbacks
title: Configuration callbacks
toplevel: true
---

import Figure from '../../figure'

We use Jexl (see https://github.com/TomFrost/Jexl) for defining configuration
callbacks.

An example of a Jexl configuration callback might look like this:

    "color": "jexl:get(feature,'strand')==-1?'red':'blue'"

The notation `get(feature,'strand')` is the same as `feature.get('strand')` in
javascript code.

We have a number of other functions, such as:

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

The getTag function smooths over slight differences in BAM and CRAM features to access their tags

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
