---
id: rootappmenumixin
title: RootAppMenuMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/RootMenu/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/RootAppMenuMixin.md)

## Docs

### RootAppMenuMixin - Actions

#### action: setMenus

```js
// type signature
setMenus: (newMenus: Menu[]) => void
```

#### action: appendMenu

Add a top-level menu

```js
// type signature
appendMenu: (menuName: string) => void
```

#### action: insertMenu

Insert a top-level menu

```js
// type signature
insertMenu: (menuName: string, position: number) => void
```

#### action: appendToMenu

Add a menu item to a top-level menu

```js
// type signature
appendToMenu: (menuName: string, menuItem: MenuItem) => void
```

#### action: insertInMenu

Insert a menu item into a top-level menu

```js
// type signature
insertInMenu: (menuName: string, menuItem: MenuItem, position: number) => void
```

#### action: appendToSubMenu

Add a menu item to a sub-menu

```js
// type signature
appendToSubMenu: (menuPath: string[], menuItem: MenuItem) => void
```

#### action: insertInSubMenu

Insert a menu item into a sub-menu

```js
// type signature
insertInSubMenu: (menuPath: string[], menuItem: MenuItem, position: number) => void
```
