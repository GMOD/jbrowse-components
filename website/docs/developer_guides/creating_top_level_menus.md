---
title: Creating new top-level menus
id: top_level_menus
---

Users can customize the top-level menu items using these functions that are
available on the rootModel:

#### `appendMenu`

Add a top-level menu

##### Parameters

| Name     | Description                 |
| -------- | --------------------------- |
| menuName | Name of the menu to insert. |

##### Return Value

The new length of the top-level menus array

#### `insertMenu`

Insert a top-level menu

##### Parameters

| Name     | Description                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| menuName | Name of the menu to insert.                                                                                                                 |
| position | Position to insert menu. If negative, counts from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the second-to-last one. |

##### Return Value

The new length of the top-level menus array

#### `appendToMenu`

Add a menu item to a top-level menu

##### Parameters

| Name     | Description                              |
| -------- | ---------------------------------------- |
| menuName | Name of the top-level menu to append to. |
| menuItem | Menu item to append.                     |

##### Return Value

The new length of the menu

#### `insertInMenu`

Insert a menu item into a top-level menu

##### Parameters

| Name     | Description                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| menuName | Name of the top-level menu to insert into.                                                                                                       |
| menuItem | Menu item to insert.                                                                                                                             |
| position | Position to insert menu item. If negative, counts from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the second-to-last one. |

##### Return Value

The new length of the menu

#### `appendToSubMenu`

Add a menu item to a sub-menu

##### Parameters

| Name     | Description                                                                                   |
| -------- | --------------------------------------------------------------------------------------------- |
| menuPath | Path to the sub-menu to add to, starting with the top-level menu (e.g. `['File', 'Insert']`). |
| menuItem | Menu item to append.                                                                          |

##### Return value

The new length of the sub-menu

#### `insertInSubMenu`

Insert a menu item into a sub-menu

##### Parameters

| Name     | Description                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| menuPath | Path to the sub-menu to add to, starting with the top-level menu (e.g. `['File', 'Insert']`).                                                    |
| menuItem | Menu item to insert.                                                                                                                             |
| position | Position to insert menu item. If negative, counts from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the second-to-last one. |

##### Return value

The new length of the sub-menu
