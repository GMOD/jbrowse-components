---
id: basewebsession
title: BaseWebSession
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/BaseWebSession/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseWebSession.md)

## Overview

Finalized web session without the session-database management surface. Used by
the embedded react-app; jbrowse-web composes `WebSessionManagementMixin` before
finalizing.

### BaseWebSession - Properties

#### property: sessionPlugins

```js
// type signature
IArrayType<IType<PluginDefinition & { name: string; }, PluginDefinition & { name: string; }, PluginDefinition & { name: string; }>>
// code
sessionPlugins: types.array(
        types.frozen<PluginDefinition & { name: string }>(),
      )
```

### BaseWebSession - Volatiles

#### volatile: sessionThemeName

```js
// type signature
string
// code
sessionThemeName: localStorageGetItem('themeName') ?? 'default'
```

#### volatile: pendingFileHandleIds

```js
// type signature
string[]
// code
pendingFileHandleIds: [] as string[]
```

### BaseWebSession - Getters

#### getter: tracks

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: root

```js
// type
AbstractWebRootModel
```

#### getter: connections

list of config connections and session connections

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: shareURL

```js
// type
any
```

#### getter: textSearchManager

```js
// type
TextSearchManager
```

### BaseWebSession - Methods

#### method: getTrackActions

raw track actions (Settings, Copy, Delete) without submenu wrapper

```js
// type signature
getTrackActions: (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: { ...; } | undefined) => MenuItem[]
```

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```js
// type signature
getTrackListMenuItems: (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: { ...; } | undefined) => MenuItem[]
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, extraTrackActions: MenuItem[] | undefined, effectiveConfig: Record<...>, view?: { ...; } | undefined) => MenuItem[]
```

### BaseWebSession - Actions

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (conf: AnyConfiguration) => void
```

#### action: addSessionPlugin

```js
// type signature
addSessionPlugin: (plugin: PluginDefinition & { name: string; }) => void
```

#### action: removeSessionPlugin

```js
// type signature
removeSessionPlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<_OverrideProps<Omit<_OverrideProps<_OverrideProps<_OverrideProps<Omit<{}, never>, _OverrideProps<_OverrideProps<Omit<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<...>; focusedViewId...
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | { ...; }) => void
```
