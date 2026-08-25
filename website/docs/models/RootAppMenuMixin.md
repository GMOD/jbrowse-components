---
id: rootappmenumixin
title: RootAppMenuMixin
sidebar_label: Mixin -> RootAppMenuMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/RootMenu/index.ts).

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-mutablemenuactions">**mutableMenuActions**</span><br><code>mutableMenuActions: [] as MenuAction[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setmenus">**setMenus**</span><br><code>(newMenus: MenuDefinition[]) =&gt; void</code> | Replace the menu bar wholesale. Item contributions recorded before this one are dropped along with the menus they targeted, so a plugin adding to the existing bar wants `appendToMenu` instead. |
| <span id="action-appendmenu">**appendMenu**</span><br><code>(menuName: string) =&gt; void</code> | Add a top-level menu, if the app bar does not already have one with this name. |
| <span id="action-insertmenu">**insertMenu**</span><br><code>(menuName: string, position: number) =&gt; void</code> | Insert a top-level menu, if the app bar does not already have one with this name. |
| <span id="action-appendtomenu">**appendToMenu**</span><br><code>(menuName: string, menuItem: MenuItem) =&gt; void</code> | Add a menu item to a top-level menu, creating the menu if it does not exist. |
| <span id="action-insertinmenu">**insertInMenu**</span><br><code>(menuName: string, menuItem: MenuItem, position: number) =&gt; void</code> | Insert a menu item into a top-level menu, creating the menu if it does not exist. |
| <span id="action-appendtosubmenu">**appendToSubMenu**</span><br><code>(menuPath: string[], menuItem: MenuItem) =&gt; void</code> | Add a menu item to a sub-menu, creating any part of the path that does not exist. |
| <span id="action-insertinsubmenu">**insertInSubMenu**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(menuPath: string[], menuItem: MenuItem, position: number) =&gt; v…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(menuPath: string[], menuItem: MenuItem, position: number) =&gt; void</code></pre></dialog></span> | Insert a menu item into a sub-menu, creating any part of the path that does not exist. |
