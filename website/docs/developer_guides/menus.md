---
title: Menus
description:
  Add items to the application menu bar, the track menu, and track context menus
guide_category: Plugins
---

**TL;DR:** Add application menus from your plugin's `configure()` (guarded by
`isAbstractMenuManager`), and extend track/context menus by redefining
`trackMenuItems`/`contextMenuItems` on the display model.

## Adding a top-level menu

The top bar of JBrowse Web and Desktop has `File`, `Add`, `Tools`, and `Help`
menus by default. You can add your own menu, add items or sub-menus to existing
ones, and nest sub-menus arbitrarily deep.

<Figure src="/img/top_level_menus.png" caption="In the above screenshot, the `Add` menu provides quick access to adding a view via the UI; this is a good place to consider adding your own custom view type."/>

Add menus in your plugin's `configure` method. Only Web and Desktop have
top-level menus; embeddable products like JBrowse Linear View don't. Guard with
`isAbstractMenuManager` so the rest of the plugin still works when there is no
menu. This is how the spreadsheet-view plugin puts itself in the `Add` menu —
`install` registers the view type, `configure` offers the way to open one:

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
        onClick: (session: AbstractSessionModel) => {
          session.addView('SpreadsheetView', {})
        },
      })
    }
  }
}
```

## Adding track menu items

A custom track populates its track menu via the `trackMenuItems` view on the
track model. It is a **method**, not a getter — `BaseTrackModel` calls
`d.trackMenuItems()` on each of its displays — so an override redefines a method
too. Capture the super version first (the same
[super-capture pattern](/docs/developer_guides/mst_patterns#self-over-this-in-views)
as any extended MST view):

<!-- include: plugins/maf/src/LinearMafDisplay/stateModel.ts#superMethod -->

```ts
.views(self => {
  const { trackMenuItems: superTrackMenuItems } = self
  return {
    /**
     * #method
     */
    trackMenuItems() {
      return [...superTrackMenuItems(), ...buildMafTrackMenuItems(self)]
    },
  }
})
```

## Adding track context-menu items

Right-clicking a linear track shows a context menu when items are defined for
it. Items can vary by whether the click hit a feature and by which feature.

<Figure src="/img/linear_align_ctx_menu.png" caption="A screenshot of a context menu available on a linear genome view track. Here, we see the context menu of a feature right-clicked on a LinearAlignmentsDisplay."/>

Extend the display model's `contextMenuItems` view via the
`Core-extendPluggableElement`
[extension point](/docs/developer_guides/extension_points):

<!-- include: plugins/dotplot-view/src/DotplotReadVsRef/index.ts#contextMenu -->

```ts
export default function DotplotReadVsRefMenuItem(pluginManager: PluginManager) {
  extendDisplayType(pluginManager, 'LinearAlignmentsDisplay', stateModel =>
    stateModel.extend((self: LinearAlignmentsDisplayModel) => {
      const superContextMenuItems = self.contextMenuItems
      return {
        views: {
          // Offered from the read id, which the hit test carries, so the
          // item is there when the menu opens rather than a fetch later;
          // the feature it needs is resolved in the onClick (normally
          // already in hand, since the fetch rebuilds this menu).
          contextMenuItems() {
            const featureId = self.contextMenuFeatureId
            const feature = self.contextMenuFeature
            const track = getContainingTrack(self)
            const items = superContextMenuItems()
            if (featureId !== undefined) {
              pushLaunchViewMenuItem(items, {
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
              })
            }
            return items
          },
        },
      }
    }),
  )
}
```

## MenuItems objects

A `MenuItem` object defines a menu item's text, icon, action, and other
attributes. Types of `MenuItem`s:

- Normal - a standard menu item that performs an action when clicked
- Checkbox - a menu item that has a checkbox
- Radio - a menu item that has a radio button icon
- Divider - a horizontal line (not clickable) that can be used to visually
  divide menus
- SubHeader - text (not clickable) that can be used to visually label a section
  of a menu
- SubMenu - contains menu items, for making nested menus
- Custom - renders arbitrary React content inline (e.g. a slider) instead of a
  clickable row

Each shape, with the fields it requires. `icon` is any
[MUI icon](https://mui.com/material-ui/material-icons/); note `keepMenuOpen`,
which decides whether a click dismisses the menu and defaults by row type rather
than being a plain flag:

<!-- include: packages/core/src/ui/MenuTypes.ts#menuItem -->

```ts
export interface MenuDivider {
  priority?: number
  type: 'divider'
}

export interface MenuSubHeader {
  type: 'subHeader'
  priority?: number
  label: string
}

// onClick receives a context argument (e.g. the session or track-selector
// model) whose concrete type varies by where the item is registered, while the
// renderer invokes it with no argument. A single `MenuItem[]` array can hold
// handlers expecting different context types, so the parameter list stays `any`
// rather than a generic that callers would have to cast through.
export type MenuItemClickHandler = (...args: any[]) => void

export interface BaseMenuItem {
  id?: string
  label: React.ReactNode
  priority?: number
  subLabel?: string
  icon?: React.ElementType
  disabled?: boolean
  helpText?: string
  /** tooltip shown when the item is disabled, in place of helpText */
  disabledHelpText?: string
  /**
   * Override whether the menu stays open after this row is clicked. Leave it
   * unset and the row TYPE decides: a `checkbox`/`radio` is a setting, so the
   * menu stays put (users flip several in one visit, and the menu content is an
   * observer, so its checked marks update live), while every other row is an
   * action and dismisses.
   *
   * Set `false` on a checkbox/radio whose click is really terminal — it opens a
   * dialog ("Custom...", "Solid color...") or swaps the display out from under
   * the menu. Set `true` on a non-checkbox row that should survive its click.
   */
  keepMenuOpen?: boolean
  /**
   * Extra content rendered at the trailing (right) edge of the row, after the
   * checkbox/radio decoration and help icon — e.g. a secondary toggle. The
   * content must `stopPropagation` on its own click so it doesn't fire the row's
   * onClick or dismiss the menu.
   *
   * An **element**, so a module that sets it drags React and whatever it renders
   * into its own graph. That is fine for the one-off it exists for (synteny's
   * color swatch) and wrong for the common case, which is why the pin below is
   * a description instead. Prefer `pin`; reach for this only when the
   * content is genuinely arbitrary.
   */
  endAdornment?: React.ReactNode
  /**
   * The trailing "default for all tracks of this type" pin, as a **description**
   * rather than an element — the renderer builds `PinAdornment` from
   * it. Same rule as a `TrackControlProps` icon name (reference/DISPLAYCHROME.md):
   * menu-item builders are called from state models and menu modules, which are
   * eager, so an element here puts MUI's `ToggleButton`, `Tooltip` and two icons
   * into every host's first paint. It did, until 2026-08-05; see
   * reference/EAGER_BUNDLE.md.
   *
   * Set it through `promotableToggleItem`/`promotableRadioItem`, not by hand.
   *
   * A `type: 'custom'` row (`makePromotableSizeMenu`) draws its own pin inside
   * its rendered content and still sets this — the declaration is what lets a
   * built menu be asked which promotable slots it offers a pin for at all. Such
   * a row is excluded from the trailing-column reservation; see
   * `hasMenuItemAdornment`.
   */
  pin?: MenuItemPin
}

/**
 * A row's pin declaration: the {@link Pin} `makePin` built, plus the one thing
 * the row knows and the pin doesn't — what to call the setting.
 *
 * **`control` holds the pin by reference; don't flatten this into
 * `interface MenuItemPin extends Pin`.** That was tried, to save the hop every
 * reader spells (`item.pin.control.active`), and it turns the declaration into a
 * *copy* of the control — so a `Pin` whose `toggle` resolves anything through
 * `this` silently mutates the copy and the real control never changes. Nothing in
 * `Pin` promises copy-safety: `makePin` happens to close over what it needs, but
 * the interface is a plain object a plugin can build by hand, and the failure is
 * a pin that draws correctly and does nothing. Two hops in `pinnedSlots` and
 * `menuItemAdornment` is the whole cost of not having that.
 */
export interface MenuItemPin {
  control: Pin
  /**
   * Names the setting in the pin's tooltip and aria-label. Carried here rather
   * than read off the row's `label`, which is a `ReactNode` and may not be a
   * string; a pin that can't name what it promotes reads as a bug.
   */
  label: string
}

export interface NormalMenuItem extends BaseMenuItem {
  type?: 'normal'
  onClick: MenuItemClickHandler
}

export interface CheckboxMenuItem extends BaseMenuItem {
  type: 'checkbox'
  checked: boolean
  onClick: MenuItemClickHandler
}

export interface RadioMenuItem extends BaseMenuItem {
  type: 'radio'
  checked: boolean
  onClick: MenuItemClickHandler
}

export interface SubMenuItem extends BaseMenuItem {
  type?: 'subMenu'
  subMenu: MenuItem[]
}

// Renders arbitrary React content inline in the menu (e.g. a slider) instead of
// a clickable row. The menu is not dismissed when interacting with it, so a
// control can be dragged live; `onClose` is passed for content that wants to
// close the menu explicitly. `label` is used only as a React key/testid.
export interface CustomMenuItem extends BaseMenuItem {
  type: 'custom'
  render: (onClose: () => void) => React.ReactNode
}
```

`MenuItem` is the union of them, and is what every menu-producing view returns:

<!-- include: packages/core/src/ui/MenuTypes.ts#menuItemUnion -->

```ts
export type MenuItem =
  | MenuDivider
  | MenuSubHeader
  | NormalMenuItem
  | CheckboxMenuItem
  | RadioMenuItem
  | SubMenuItem
  | CustomMenuItem
```

Each variant is one of the interfaces above: `type` is omitted for a plain row,
`divider` and `subHeader` carry no handler, `checkbox` and `radio` carry a
`checked` boolean, `subMenu` nests another `MenuItem[]`, and `custom` renders
arbitrary content inline without dismissing the menu.

Prefer the builders in `@jbrowse/core/ui/menuItems` over writing the objects
out: `checkboxItem`, `radioItems`, `promotableToggleItem` and
`promotableRadioItem` produce these shapes, and that entry is React-free, so a
state model or a plugin `menuItems` module can build rows without pulling the
Material UI barrel into every host that installs it.

## Root model Menu API

The root model exposes actions for customizing top-level menus at runtime,
called from a plugin's `configure()` and guarded by `isAbstractMenuManager` as
shown above. Each takes a `menuName`/`menuPath`, and the `insert*` variants take
a `position` that counts from the end when negative. A contribution is recorded
rather than applied immediately: it is merged into the menu each time that menu
opens, so none of them return anything, and one that throws costs your item
rather than the app. See the
[`RootAppMenuMixin` state model](/docs/models/rootappmenumixin) for
auto-generated signatures:

- [`appendMenu`](/docs/models/rootappmenumixin/#action-appendmenu) - add a
  top-level menu
- [`insertMenu`](/docs/models/rootappmenumixin/#action-insertmenu) - insert a
  top-level menu at a position
- [`appendToMenu`](/docs/models/rootappmenumixin/#action-appendtomenu) - add an
  item to a top-level menu
- [`insertInMenu`](/docs/models/rootappmenumixin/#action-insertinmenu) - insert
  an item into a top-level menu at a position
- [`appendToSubMenu`](/docs/models/rootappmenumixin/#action-appendtosubmenu) -
  add an item to a sub-menu
- [`insertInSubMenu`](/docs/models/rootappmenumixin/#action-insertinsubmenu) -
  insert an item into a sub-menu at a position

## See also

- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/pluggable_elements)
