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

<details>
<summary>ConfigurationEditorWidget - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<'ConfigurationEditorWidget'>
// code
type: types.literal('ConfigurationEditorWidget')
```

</details>

<details>
<summary>ConfigurationEditorWidget - Volatiles</summary>

#### volatile: target

```ts
// type signature
type target = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | undefined
// code
target: undefined as AnyConfigurationModel | undefined
```

#### volatile: expandedDisplayId

```ts
// type signature
type expandedDisplayId = string | undefined
// code
expandedDisplayId: undefined as string | undefined
```

</details>

<details>
<summary>ConfigurationEditorWidget - Actions</summary>

#### action: setTarget

```ts
type setTarget = (newTarget: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | undefined) => void
```

#### action: setExpandedDisplayId

```ts
type setExpandedDisplayId = (displayId: string | undefined) => void
```

</details>
