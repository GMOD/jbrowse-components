---
id: pluginstorewidget
title: PluginStoreWidget
sidebar_label: Widget -> PluginStoreWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/PluginStoreWidget/model.ts).

## Overview

Widget backing the plugin store: holds the text filter applied to the
installable plugin list and the view it was opened from.

<details>
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

<details>
<summary>PluginStoreWidget - Actions</summary>

#### action: setFilterText

```ts
type setFilterText = (newText: string) => void
```

</details>
