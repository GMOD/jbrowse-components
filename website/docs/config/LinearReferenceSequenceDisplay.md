---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
sidebar_label: Display -> LinearReferenceSequenceDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearReferenceSequenceDisplay.md)

## Example usage

A complete `ReferenceSequenceTrack` config to paste into `tracks` (an assembly's
`sequence` track takes the same shape). `showForward`, `showReverse`, and
`showTranslation` toggle the strand/translation rows:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearReferenceSequenceDisplay',
      displayId: 'refseq-LinearReferenceSequenceDisplay',
      showTranslation: false,
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### LinearReferenceSequenceDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearreferencesequencedisplay).

<details open>
<summary>LinearReferenceSequenceDisplay - Slots</summary>

#### slot: height

explicit display height (e.g. from a drag-resize); unset means auto-fit to the
zoom-aware computed height. See the model's `height` getter.

**Type:** `maybeNumber`

```js
{
  type: 'maybeNumber',
  description: 'display height in pixels; unset auto-fits to the sequence',
  defaultValue: undefined,
}
```

#### slot: showForward

show the forward-strand sequence row

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'show the forward-strand sequence row',
}
```

#### slot: showReverse

show the reverse-complement sequence row (DNA only)

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'show the reverse-complement sequence row (DNA only)',
}
```

#### slot: showTranslation

show the translation frame rows (DNA only)

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'show the translation frame rows (DNA only)',
}
```

</details>
