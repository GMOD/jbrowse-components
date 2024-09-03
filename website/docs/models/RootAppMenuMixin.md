---
id: rootappmenumixin
title: RootAppMenuMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/app-core/src/RootMenu/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/RootMenu/index.ts)

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
appendMenu: (menuName: string) => number
```

#### action: insertMenu

Insert a top-level menu

```js
// type signature
insertMenu: (menuName: string, position: number) => number
```

#### action: appendToMenu

Add a menu item to a top-level menu

```js
// type signature
appendToMenu: (menuName: string, menuItem: MenuItem) => number
```

#### action: insertInMenu

Insert a menu item into a top-level menu

```js
// type signature
insertInMenu: (menuName: string, menuItem: MenuItem, position: number) => number
```

#### action: appendToSubMenu

Add a menu item to a sub-menu

```js
// type signature
appendToSubMenu: (menuPath: string[], menuItem: MenuItem) => number
```

#### action: insertInSubMenu

Insert a menu item into a sub-menu

```js
// type signature
insertInSubMenu: (menuPath: string[], menuItem: MenuItem, position: number) => number
```
