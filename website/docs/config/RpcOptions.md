---
id: rpcoptions
title: RpcOptions
sidebar_label: Root -> RpcOptions
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/rpc/configSchema.ts).

## Overview

| Slot                                 | Type     | Description                                                                                                                                                                                                                               |
| ------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [defaultDriver](#slot-defaultdriver) | `string` | which RPC backend to use by default. Empty means "use the host application's default" (web/desktop default to the web worker driver, embedded/headless to the main thread). A per-track or per-call `rpcDriverName` still overrides this. |
| [workerCount](#slot-workercount)     | `number` | number of web workers to spawn for the web worker RPC driver. 0 lets JBrowse pick based on hardware concurrency.                                                                                                                          |

<details>
<summary>RpcOptions - Slots</summary>

#### slot: defaultDriver

which RPC backend to use by default. Empty means "use the host application's
default" (web/desktop default to the web worker driver, embedded/headless to the
main thread). A per-track or per-call `rpcDriverName` still overrides this.

**Type:** `string` · **Default:** `''` · _advanced_

#### slot: workerCount

number of web workers to spawn for the web worker RPC driver. 0 lets JBrowse
pick based on hardware concurrency.

**Type:** `number` · **Default:** `0` · _advanced_

</details>
