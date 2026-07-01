---
id: configurationeditorwidget
title: ConfigurationEditorWidget
sidebar_label: Widget -> ConfigurationEditorWidget
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/ConfigurationEditorWidget/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/ConfigurationEditorWidget.md)

## Overview

Widget for editing a config model's slots in a form: holds the target
configuration and debounce-saves edits back to the session.

<details open>
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

<details open>
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

<details open>
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
