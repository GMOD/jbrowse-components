---
id: referencemanagementsessionmixin
title: ReferenceManagementSessionMixin
sidebar_label: Mixin -> ReferenceManagementSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/ReferenceManagement.ts).

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-getreferringmultiple">**getReferringMultiple**</span><br><code>(trackIds: string[]) =&gt; Map&lt;string, ReferringNode[]&gt;</code> | Walk the tree once and map each requested trackId to the nodes holding a `types.reference` that resolves to it (a view's track entry, a config editor widget). Track configs are matched by trackId, not identity, so a frozen base and its hydrated MST node compare equal. |
| <span id="method-getreferring">**getReferring**</span><br><code>(trackId: string) =&gt; ReferringNode[]</code> | The nodes currently referring to `trackId` (see getReferringMultiple). |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-dereferencetrack">**dereferenceTrack**</span><br><code>(trackId: string, referring: ReferringNode[]) =&gt; void</code> | Remove `trackId` from every view referring to it and close any config editor widget open on it. Runs immediately: the walk that produced `referring` has finished, so mutating those views here is safe. |
