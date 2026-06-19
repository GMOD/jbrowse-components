---
id: referencesequencetrack
title: ReferenceSequenceTrack
sidebar_label: Track -> ReferenceSequenceTrack
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ReferenceSequenceTrack/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ReferenceSequenceTrack.md)

## Example usage

Usually authored as the `sequence` member of an assembly rather than a top-level
track:

```js
sequence: {
  type: 'ReferenceSequenceTrack',
  trackId: 'hg38-ref',
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/hg38.fa',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to display base level DNA sequence tracks

### ReferenceSequenceTrack - Display types

A track is just a container; the actual rendering behavior and config slots live
on its display type(s):

- [LinearGCContentDisplay](../lineargccontentdisplay)
  ([state model](../../models/lineargccontentdisplay))
- [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)
  ([state model](../../models/linearreferencesequencedisplay))

### ReferenceSequenceTrack - Identifier

#### slot: explicitIdentifier

<details open>
<summary>ReferenceSequenceTrack - Slots</summary>

#### slot: adapter

configuration for track adapter

```js
pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: displays

configuration for the displays e.g. LinearReferenceSequenceDisplay

```js
types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: name

```js
{
  type: 'string',
  description:
    'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
  defaultValue: '',
}
```

#### slot: sequenceType

```js
{
  type: 'string',
  description: 'either dna or pep',
  defaultValue: 'dna',
}
```

#### slot: description

```js
{
  description: 'a description of the track',
  type: 'string',
  defaultValue: '',
}
```

#### slot: metadata

```js
{
  type: 'frozen',
  description: 'anything to add about this track',
  defaultValue: {},
}
```

#### slot: formatAbout.config

```js
{
  type: 'frozen',
  description: 'formats configuration in about dialog',
  defaultValue: {},
  contextVariable: ['config'],
}
```

#### slot: formatAbout.hideUris

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

</details>
