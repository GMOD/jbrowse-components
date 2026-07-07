---
id: rootappmenumixin
title: RootAppMenuMixin
sidebar_label: Mixin -> RootAppMenuMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/RootMenu/index.ts).

## Overview

## Members

| Member                                             | Kind      | Description                              |
| -------------------------------------------------- | --------- | ---------------------------------------- |
| [mutableMenuActions](#volatile-mutablemenuactions) | Volatiles |                                          |
| [setMenus](#action-setmenus)                       | Actions   |                                          |
| [appendMenu](#action-appendmenu)                   | Actions   | Add a top-level menu                     |
| [insertMenu](#action-insertmenu)                   | Actions   | Insert a top-level menu                  |
| [appendToMenu](#action-appendtomenu)               | Actions   | Add a menu item to a top-level menu      |
| [insertInMenu](#action-insertinmenu)               | Actions   | Insert a menu item into a top-level menu |
| [appendToSubMenu](#action-appendtosubmenu)         | Actions   | Add a menu item to a sub-menu            |
| [insertInSubMenu](#action-insertinsubmenu)         | Actions   | Insert a menu item into a sub-menu       |

<details>
<summary>RootAppMenuMixin - Volatiles</summary>

#### volatile: mutableMenuActions

```ts
// type signature
type mutableMenuActions = MenuAction[]
// code
mutableMenuActions: [] as MenuAction[]
```

</details>

<details>
<summary>RootAppMenuMixin - Actions</summary>

#### action: appendMenu

Add a top-level menu

```ts
type appendMenu = (menuName: string) => void
```

#### action: insertMenu

Insert a top-level menu

```ts
type insertMenu = (menuName: string, position: number) => void
```

#### action: appendToMenu

Add a menu item to a top-level menu

```ts
type appendToMenu = (menuName: string, menuItem: MenuItem) => void
```

#### action: insertInMenu

Insert a menu item into a top-level menu

```ts
type insertInMenu = (
  menuName: string,
  menuItem: MenuItem,
  position: number,
) => void
```

#### action: appendToSubMenu

Add a menu item to a sub-menu

```ts
type appendToSubMenu = (menuPath: string[], menuItem: MenuItem) => void
```

#### action: insertInSubMenu

Insert a menu item into a sub-menu

```ts
type insertInSubMenu = (
  menuPath: string[],
  menuItem: MenuItem,
  position: number,
) => void
```

</details>

<details>
<summary>RootAppMenuMixin - Actions (other undocumented members)</summary>

#### action: setMenus

```ts
type setMenus = (newMenus: Menu[]) => void
```

</details>
