---
id: jbrowsedesktopsessionmodel
title: JBrowseDesktopSessionModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[products/jbrowse-desktop/src/sessionModel/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/index.ts)

## Docs

inherits SnackbarModel

### JBrowseDesktopSessionModel - Getters

#### getter: history

```js
// type
any
```

#### getter: menus

```js
// type
any
```

#### getter: savedSessionNames

```js
// type
any
```

### JBrowseDesktopSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: any
}
```

### JBrowseDesktopSessionModel - Actions

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => Promise<void>
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { description: string; type: string; defaultValue: string; }; ... 8 more ...; formatAbout: ConfigurationSchemaType<...>; }, ConfigurationSchemaOptions<...>...
```
