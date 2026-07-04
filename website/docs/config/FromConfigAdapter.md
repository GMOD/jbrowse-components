---
id: fromconfigadapter
title: FromConfigAdapter
sidebar_label: Adapter -> FromConfigAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigAdapter/configSchema.ts).

## Overview

<details open>
<summary>FromConfigAdapter - Slots</summary>

#### slot: adapterId

stable identifier used as the adapter cache key; avoids hashing the (potentially
large) features array. optional — falls back to hash.

**Type:** `string` · **Default:** `''`

#### slot: features

**Type:** `frozen` · **Default:** `[]`

</details>
