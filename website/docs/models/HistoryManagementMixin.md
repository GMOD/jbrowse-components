---
id: historymanagementmixin
title: HistoryManagementMixin
description: "Adds undo and redo of session changes to the root model, bound to Ctrl+Z and Ctrl+Y (Cmd on macOS)."
sidebar_label: Mixin -> HistoryManagementMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/HistoryManagement/index.ts).

Adds undo and redo of session changes to the root model, bound to Ctrl+Z
and Ctrl+Y (Cmd on macOS).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-history">**history**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>history: types.optional(TimeTraveller, { targetPath: '../sessio…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>history: types.optional(TimeTraveller, { targetPath: '../session' })</code></pre></dialog></span> | used for undo/redo |
