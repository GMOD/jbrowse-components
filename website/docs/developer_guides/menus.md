---
title: Menus
description:
  Add items to the application menu bar, the track menu, and track context menus
guide_category: Plugins
---

**TL;DR:** three surfaces, three mechanisms. The app menu bar takes
contributions from a plugin's `configure()`, guarded by `isAbstractMenuManager`;
a track menu and a right-click menu are the display model's `trackMenuItems()`
and `contextMenuItems()`, captured from the super method where the display is
defined and added to with `addDisplayMenuItems` from anywhere else. All three
carry the same `MenuItem[]`.

## Adding a top-level menu

JBrowse Web, Desktop and React App define `File`, `Add` and `Tools`. The `menus`
plugin adds `Help` with `appendToMenu`, which creates the menu when it is
absent. The embeddable single-view components have no menu bar at all, so guard
with `isAbstractMenuManager`.

<Figure src="/img/top_level_menus.png" caption="In the above screenshot, the `Add` menu provides quick access to adding a view via the UI; this is a good place to consider adding your own custom view type."/>

Contribute from `configure`: the spreadsheet-view plugin registers its view type
in `install` and offers the way to open one in `configure`.

<!-- include: plugins/spreadsheet-view/src/index.ts#plugin -->

```ts
export default class SpreadsheetViewPlugin extends Plugin {
  name = 'SpreadsheetViewPlugin'

  install(pluginManager: PluginManager) {
    SpreadsheetViewF(pluginManager)
    LaunchSpreadsheetViewF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    const { rootModel } = pluginManager
    // configure also runs in the web worker, which has no rootModel — the
    // guard is what keeps a menu contribution from throwing there
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToMenu('Add', {
        label: 'Spreadsheet view',
        icon: ViewComfyIcon,
        onClick: (session: AbstractViewContainer) => {
          session.addView('SpreadsheetView', {})
        },
      })
    }
  }
}
```

## Adding track menu items

A track's menu is `self.displays.flatMap(d => d.trackMenuItems())`, so a display
contributes by redefining `trackMenuItems`. It is a **method**, not a getter, so
capture the super version first — the same
[super-capture pattern](/docs/developer_guides/mst_patterns#self-over-this-in-views)
as any extended MST view. This is the shape for a display's **own** menu, built
where the display is defined; to add to one belonging to another plugin, use
`addDisplayMenuItems` below.

<!-- include: plugins/maf/src/LinearMafDisplay/stateModel.ts#superMethod -->

```ts
.views(self => {
  const { trackMenuItems: superTrackMenuItems } = self
  return {
    /**
     * #method
     */
    trackMenuItems() {
      return [
        ...superTrackMenuItems(),
        ...buildMafTrackMenuItems(self),
        ...mafLaunchMenuItems({
          session: getSession(self),
          model: self,
          view: getContainingView(self) as LinearGenomeViewModel,
        }),
      ]
    },
  }
})
```

## Adding track context-menu items

Right-clicking a linear track opens `contextMenuItems`, which can vary by
whether the click hit a feature and by which one.

<Figure src="/img/linear_align_ctx_menu.png" caption="A screenshot of a context menu available on a linear genome view track. Here, we see the context menu of a feature right-clicked on a LinearAlignmentsDisplay."/>

To add items to a menu on a display you do not own, use `addDisplayMenuItems`
(`addViewMenuItems` for a view):

- **Resolves the display type by name**, and appends what your callback returns
  to what is already there.
- **An array of names** contributes the same items to several types from one
  call. Your callback is then handed the union of their models, so it may only
  use a menu they all have — a menu only one of them has is a compile error
  rather than a `self[menu]` that is undefined on the rest.
- **`group`** collects several plugins' entries into one submenu. Without it,
  each contribution becomes its own top-level row.
- **`undefined`** from the callback adds nothing, which is how an item scoped to
  some state opts out.

<!-- include: plugins/dotplot-view/src/DotplotReadVsRef/index.ts#contextMenu -->

```ts
export default function DotplotReadVsRefMenuItem(pluginManager: PluginManager) {
  addDisplayMenuItems(pluginManager, 'LinearAlignmentsDisplay', {
    menu: 'contextMenuItems',
    group: LAUNCH_LABEL,
    // Offered from the read id, which the hit test carries, so the item is
    // there when the menu opens rather than a fetch later; the feature it needs
    // is resolved in the onClick (normally already in hand, since the fetch
    // rebuilds this menu).
    items: self => {
      const featureId = self.contextMenuFeatureId
      const feature = self.contextMenuFeature
      const track = getContainingTrack(self)
      return featureId === undefined
        ? undefined
        : {
            label: 'Dotplot of read vs ref',
            icon: AddIcon,
            onClick: () => {
              withContextMenuFeature(self, featureId, feature, feat => {
                queueReadVsRefDialog({
                  node: self,
                  track,
                  feature: feat,
                  onSubmit: launchDotplotReadVsRef,
                })
              })
            },
          }
    },
  })
}
```

## MenuItem

`MenuItem` is a discriminated union. Every menu-producing view returns
`MenuItem[]`.

<!-- MENU_ITEM_TYPES START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| `type` | Own fields | Description |
| --- | --- | --- |
| `checkbox` | `checked`, `onClick` | a setting row with a checkbox; leaves the menu open |
| `custom` | `render` | renders arbitrary React content inline, e.g. a slider |
| `divider` | `priority` | a horizontal rule; not clickable |
| `normal` | `onClick` | an action row; the default when `type` is omitted |
| `radio` | `checked`, `onClick` | a setting row with a radio button; leaves the menu open |
| `subHeader` | `priority`, `label` | a text label for a section of a menu; not clickable |
| `subMenu` | `subMenu` | nests another `MenuItem[]`, to any depth |

<!-- MENU_ITEM_TYPES END -->

Every variant except `divider` and `subHeader` also takes these:

<!-- MENU_ITEM_FIELDS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | stable identifier, for tests and for finding a row again |
| `label` (required) | `React.ReactNode` | the row's text |
| `priority` | `number` | sort weight within the menu; higher sorts earlier |
| `subLabel` | `string` | secondary text under the label; prefer `withHint` in the label |
| `icon` | `React.ElementType` | any [MUI icon](https://mui.com/material-ui/material-icons/) component |
| `disabled` | `boolean` | renders the row unclickable |
| `helpText` | `string` | tooltip shown from a help icon at the trailing edge |
| `disabledHelpText` | `string` | tooltip shown when the item is disabled, in place of helpText |
| `keepMenuOpen` | `boolean` | override the dismiss-on-click rule; see `staysOpenOnClick` |
| `endAdornment` | `React.ReactNode` | arbitrary trailing content; prefer `pin` |
| `pin` | `MenuItemPin` | the "make this the default for all tracks of this type" pin; set it with a promotable builder |

<!-- MENU_ITEM_FIELDS END -->

Clicking a row dismisses the menu unless it is a `checkbox` or `radio`, which
are settings and stay open. `staysOpenOnClick` is that rule, exported so a test
can assert the behavior.

## Builders

Build rows with these. Import them from `@jbrowse/core/ui/menuItems`, a
React-free entry, so a state model or plugin `menuItems` module does not pull
the Material UI barrel into every host that installs the plugin.

<!-- MENU_ITEM_BUILDERS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Builder | Description |
| --- | --- |
| `checkboxItem` | one checkbox setting row |
| `makeRadioSubMenu` | a radio group wrapped in a submenu row |
| `promotableRadioItem` | `radioItem` plus a promote-to-default pin |
| `promotableRadioItems` | `radioItems` plus a pin per option, from a factory over the value |
| `promotableToggleItem` | `checkboxItem` plus a promote-to-default pin |
| `radioItem` | one radio setting row; the singular of `radioItems` |
| `radioItems` | a radio group, one row per option |
| `showLegendCheckboxItem` | the shared "Show legend" checkbox |
| `toggleItem` | a checkbox row whose setter takes the new value |
| `withHint` | a row label carrying an aside that is only sometimes there |
| `withSubHeader` | a section heading, present only if the section is |

<!-- MENU_ITEM_BUILDERS END -->

Prefer the plural `promotableRadioItems` for a whole radio group: it takes the
pin as a factory over the option's value, so a group cannot end up one pin
short.

## Root model menu API

Called from `configure()`, guarded by `isAbstractMenuManager`. A contribution is
recorded and merged in each time the menu opens, so none of these return
anything and one that throws costs your item rather than the app. A negative
`position` counts from the end.

<!-- MENU_ACTIONS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Action | Description |
| --- | --- |
| [`setMenus(newMenus)`](/docs/models/rootappmenumixin#action-setmenus) | Replace the menu bar wholesale. Item contributions recorded before this one are dropped along with the menus they targeted, so a plugin adding to the existing bar wants `appendToMenu` instead. |
| [`appendMenu(menuName)`](/docs/models/rootappmenumixin#action-appendmenu) | Add a top-level menu, if the app bar does not already have one with this name. |
| [`insertMenu(menuName, position)`](/docs/models/rootappmenumixin#action-insertmenu) | Insert a top-level menu, if the app bar does not already have one with this name. |
| [`appendToMenu(menuName, menuItem)`](/docs/models/rootappmenumixin#action-appendtomenu) | Add a menu item to a top-level menu, creating the menu if it does not exist. |
| [`insertInMenu(menuName, menuItem, position)`](/docs/models/rootappmenumixin#action-insertinmenu) | Insert a menu item into a top-level menu, creating the menu if it does not exist. |
| [`appendToSubMenu(menuPath, menuItem)`](/docs/models/rootappmenumixin#action-appendtosubmenu) | Add a menu item to a sub-menu, creating any part of the path that does not exist. |
| [`insertInSubMenu(menuPath, menuItem, position)`](/docs/models/rootappmenumixin#action-insertinsubmenu) | Insert a menu item into a sub-menu, creating any part of the path that does not exist. |

<!-- MENU_ACTIONS END -->

## See also

- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/pluggable_elements)
