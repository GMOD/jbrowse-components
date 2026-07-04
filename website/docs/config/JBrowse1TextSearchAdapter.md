---
id: jbrowse1textsearchadapter
title: JBrowse1TextSearchAdapter
sidebar_label: Adapter -> JBrowse1TextSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1TextSearchAdapter/configSchema.ts).

## Overview

note: metadata about tracks and assemblies covered by text search adapter

### JBrowse1TextSearchAdapter - Identifier

Every JBrowse1TextSearchAdapter has a unique `textSearchAdapterId`, a required
top-level field that identifies it (not one of the config slots below).

<details open>
<summary>JBrowse1TextSearchAdapter - Slots</summary>

#### slot: namesIndexLocation

the location of the JBrowse1 names index data directory

**Type:** `fileLocation` · **Default:**
`{ uri: '/volvox/names', locationType: 'UriLocation' }`

#### slot: tracks

List of tracks covered by text search adapter

**Type:** `stringArray` · **Default:** `[]`

#### slot: assemblyNames

List of assemblies covered by text search adapter

**Type:** `stringArray` · **Default:** `[]`

</details>
