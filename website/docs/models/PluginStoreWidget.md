---
id: pluginstorewidget
title: PluginStoreWidget
sidebar_label: Widget -> PluginStoreWidget
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/PluginStoreWidget/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/PluginStoreWidget.md)

## Overview

Widget backing the plugin store: holds the text filter applied to the
installable plugin list and the view it was opened from.

<details open>
<summary>PluginStoreWidget - Properties</summary>

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
type type = ISimpleType<'PluginStoreWidget'>
// code
type: types.literal('PluginStoreWidget')
```

#### property: filterText

```ts
// type signature
type filterText = string
// code
filterText: ''
```

#### property: view

```ts
// type signature
type view = IMaybe<IReferenceType<IAnyType>>
// code
view: types.safeReference(pluginManager.pluggableMstType('view', 'stateModel'))
```

</details>

<details open>
<summary>PluginStoreWidget - Actions</summary>

#### action: setFilterText

```ts
type setFilterText = (newText: string) => void
```

</details>
