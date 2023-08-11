---
id: hierarchicaltrackselectorwidget
title: HierarchicalTrackSelectorWidget
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts)

### HierarchicalTrackSelectorWidget - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"HierarchicalTrackSelectorWidget">
// code
type: types.literal('HierarchicalTrackSelectorWidget')
```

#### property: initialized

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
initialized: types.maybe(types.boolean)
```

#### property: collapsed

```js
// type signature
IMapType<ISimpleType<boolean>>
// code
collapsed: types.map(types.boolean)
```

#### property: sortTrackNames

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
sortTrackNames: types.maybe(types.boolean)
```

#### property: sortCategories

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
sortCategories: types.maybe(types.boolean)
```

#### property: view

```js
// type signature
IMaybe<IReferenceType<IAnyType>>
// code
view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      )
```

### HierarchicalTrackSelectorWidget - Getters

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: activeSortTrackNames

```js
// type
any
```

#### getter: activeSortCategories

```js
// type
any
```

#### getter: trackConfigurations

filter out tracks that don't match the current assembly/display types

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: hierarchy

```js
// type
{ name: string; id: string; children: { name: any; id: any; children: TreeNode[]; }[]; }
```

### HierarchicalTrackSelectorWidget - Methods

#### method: getRefSeqTrackConf

```js
// type signature
getRefSeqTrackConf: (assemblyName: string) => { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### method: connectionTrackConfigurations

filter out tracks that don't match the current display types

```js
// type signature
connectionTrackConfigurations: (connection: { tracks: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]; }) => ({ ...; } & ... 2 more ... & IStateTreeNode<...>)[]
```

#### method: connectionHierarchy

```js
// type signature
connectionHierarchy: (connection: { name: string; tracks: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]; }) => TreeNode[]
```

### HierarchicalTrackSelectorWidget - Actions

#### action: setSortTrackNames

```js
// type signature
setSortTrackNames: (val: boolean) => void
```

#### action: setSortCategories

```js
// type signature
setSortCategories: (val: boolean) => void
```

#### action: setSelection

```js
// type signature
setSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]) => void
```

#### action: addToSelection

```js
// type signature
addToSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]) => void
```

#### action: removeFromSelection

```js
// type signature
removeFromSelection: (elt: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]) => void
```

#### action: clearSelection

```js
// type signature
clearSelection: () => void
```

#### action: setView

```js
// type signature
setView: (view: unknown) => void
```

#### action: toggleCategory

```js
// type signature
toggleCategory: (pathName: string) => void
```

#### action: setCategoryCollapsed

```js
// type signature
setCategoryCollapsed: (pathName: string, status: boolean) => void
```

#### action: expandAllCategories

```js
// type signature
expandAllCategories: () => void
```

#### action: clearFilterText

```js
// type signature
clearFilterText: () => void
```

#### action: setFilterText

```js
// type signature
setFilterText: (newText: string) => void
```

#### action: collapseSubCategories

```js
// type signature
collapseSubCategories: () => void
```

#### action: collapseTopLevelCategories

```js
// type signature
collapseTopLevelCategories: () => void
```
