---
id: nclistadapter
title: NCListAdapter
sidebar_label: Adapter -> NCListAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/NCListAdapter/configSchema.ts).

## Overview

| Slot                                     | Type           | Description                                           |
| ---------------------------------------- | -------------- | ----------------------------------------------------- |
| [rootUrlTemplate](#slot-rooturltemplate) | `fileLocation` |                                                       |
| [refNames](#slot-refnames)               | `stringArray`  | List of refNames used by the NCList used for aliasing |

<details>
<summary>NCListAdapter - Slots</summary>

#### slot: rootUrlTemplate

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my/{refseq}/trackData.json',
    locationType: 'UriLocation',
  },
}
```

#### slot: refNames

List of refNames used by the NCList used for aliasing

**Type:** `stringArray` · **Default:** `[]`

</details>
