---
id: jbrowsedesktopsessionmodel
title: JBrowseDesktopSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/sessionModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseDesktopSessionModel.md)

## Docs

composed of

- ReferenceManagementSessionMixin
- ConnectionManagementSessionMixin
- ThemeManagerSessionMixin
- TracksManagerSessionMixin
- MultipleViewsSessionMixin
- AssembliesMixin
- DesktopSessionTrackMenuMixin
- DockviewLayoutMixin

### JBrowseDesktopSessionModel - Getters

#### getter: assemblies

```js
// type
ConfigurationSchemaType<{ aliases: { type: string; defaultValue: never[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: never[]; description: string; }; refNameAliases: ConfigurationSchemaType<...>; cytobands: ConfigurationSchemaType<...>; displayName: { ....
```

#### getter: root

```js
// type
ModelInstanceTypeProps<_OverrideProps<Omit<_OverrideProps<_OverrideProps<{ jbrowse: IAnyType; session: IMaybe<IAnyType>; sessionPath: IOptionalIType<ISimpleType<string>, [undefined]>; assemblyManager: IOptionalIType<...>; }, { ...; }>, { ...; }>, never>, { ...; }>> & ... 12 more ... & IStateTreeNode<...>
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: version

```js
// type
string
```

#### getter: history

```js
// type
ModelInstanceTypeProps<{ undoIdx: IType<number | undefined, number, number>; targetPath: IType<string | undefined, string, string>; }> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>
```

#### getter: menus

```js
// type
() => Menu[]
```

#### getter: assemblyManager

```js
// type
ModelInstanceTypeProps<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 5 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 10 more ... & { ...; }, _NotCustomized, _NotCust...
```

### JBrowseDesktopSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: Theme
  highResolutionScaling: any
}
```

### JBrowseDesktopSessionModel - Actions

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```
