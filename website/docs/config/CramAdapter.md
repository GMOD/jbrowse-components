---
id: cramadapter
title: CramAdapter
sidebar_label: Adapter -> CramAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/CramAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/CramAdapter.md)

## Example usage

The `uri` shorthand auto-resolves the `.crai` index:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'CramAdapter',
    uri: 'https://example.com/sample.cram',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to configure CRAM adapter

Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
automatically supplies it from the enclosing assembly's sequence track.

### CramAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.cram.crai:

```json
{
  "type": "CramAdapter",
  "uri": "yourfile.cram"
}
```

<details open>
<summary>CramAdapter - Slots</summary>

#### slot: fetchSizeLimit

```js
{
  type: 'number',
  description:
    'size in bytes over which to display a warning to the user that too much data will be fetched',
  defaultValue: 3_000_000,
  advanced: true,
}
```

#### slot: cramLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.cram',
    locationType: 'UriLocation',
  },
}
```

#### slot: craiLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.cram.crai',
    locationType: 'UriLocation',
  },
}
```

</details>
