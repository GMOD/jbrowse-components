---
id: historymanagementmixin
title: HistoryManagementMixin
description: "Adds undo and redo of session changes to the root model, bound to Ctrl+Z and Ctrl+Y (Cmd on macOS)."
sidebar_label: Mixin -> HistoryManagementMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/HistoryManagement/index.ts).

Adds undo and redo of session changes to the root model, bound to Ctrl+Z
and Ctrl+Y (Cmd on macOS).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-history">**history**</span><br><code>types.optional(<a href="../timetraveller">TimeTraveller</a>, { targetPath: '../session' })</code> | used for undo/redo |
