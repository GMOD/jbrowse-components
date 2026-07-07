---
id: gccontentadapter
title: GCContentAdapter
sidebar_label: Adapter -> GCContentAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gccontent`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/GCContentAdapter/configSchema.ts).

## Overview

| Slot                                     | Type                         | Description                                          |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| [sequenceAdapter](#slot-sequenceadapter) | `frozen`                     |                                                      |
| [windowSize](#slot-windowsize)           | `number`                     |                                                      |
| [windowDelta](#slot-windowdelta)         | `number`                     |                                                      |
| [gcMode](#slot-gcmode)                   | `stringEnum` (content, skew) | calculate GC content fraction or GC skew (G-C)/(G+C) |

<details>
<summary>GCContentAdapter - Slots</summary>

#### slot: sequenceAdapter

**Type:** `frozen` · **Default:** `null`

#### slot: windowSize

**Type:** `number` · **Default:** `100` · _advanced_

#### slot: windowDelta

**Type:** `number` · **Default:** `100` · _advanced_

#### slot: gcMode

calculate GC content fraction or GC skew (G-C)/(G+C)

**Type:** `stringEnum` (one of `content`, `skew`) · **Default:** `'content'`

</details>
