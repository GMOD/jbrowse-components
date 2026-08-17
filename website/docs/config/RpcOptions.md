---
id: rpcoptions
title: RpcOptions
sidebar_label: Root -> RpcOptions
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/rpc/configSchema.ts).

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-defaultdriver">**defaultDriver**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | which RPC backend to use. Empty means "use the host application's default" (web/desktop default to the web worker driver, embedded/headless to the main thread). Every call in the session runs on the driver this names; there is no per-track or per-call override.<br>_advanced_ |
| <span id="slot-workercount">**workerCount**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | number of web workers to spawn for the web worker RPC driver. 0 lets JBrowse pick based on hardware concurrency.<br>_advanced_ |
