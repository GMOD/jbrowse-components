---
id: configurationeditorwidget
title: ConfigurationEditorWidget
sidebar_label: Widget -> ConfigurationEditorWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`config` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/ConfigurationEditorWidget/model.ts).

## Overview

Widget for editing a config model's slots in a form: holds the target
configuration and debounce-saves edits back to the session.

## Members

| Member                                               | Kind       | Defined by                | Description |
| ---------------------------------------------------- | ---------- | ------------------------- | ----------- |
| [id](#property-id)                                   | Properties | ConfigurationEditorWidget |             |
| [type](#property-type)                               | Properties | ConfigurationEditorWidget |             |
| [target](#volatile-target)                           | Volatiles  | ConfigurationEditorWidget |             |
| [expandedDisplayId](#volatile-expandeddisplayid)     | Volatiles  | ConfigurationEditorWidget |             |
| [setTarget](#action-settarget)                       | Actions    | ConfigurationEditorWidget |             |
| [setExpandedDisplayId](#action-setexpandeddisplayid) | Actions    | ConfigurationEditorWidget |             |

<details>
<summary>ConfigurationEditorWidget - Properties</summary>

| Member                               | Type                                               |
| ------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>     | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-type">type</span> | `ISimpleType<"ConfigurationEditorWidget">`         |

</details>

<details>
<summary>ConfigurationEditorWidget - Volatiles</summary>

| Member                                                         | Type                                                                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="volatile-target">target</span>                       | `(ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) \| undefined` |
| <span id="volatile-expandeddisplayid">expandedDisplayId</span> | `string \| undefined`                                                                                                                                                         |

</details>

<details>
<summary>ConfigurationEditorWidget - Actions</summary>

| Member                                                             | Type                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| <span id="action-settarget">setTarget</span>                       | `(newTarget: (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) \| undefined) => void` |
| <span id="action-setexpandeddisplayid">setExpandedDisplayId</span> | `(displayId: string \| undefined) => void`                                                |

</details>
