---
title: Top-level menu items
description: Add items to the top-level application menu bar
guide_category: Creating pluggable elements
---

## Adding a top-level menu

These are the menus that appear in the top bar of JBrowse Web and JBrowse
Desktop. By default, there are `File`, `Add`, `Tools`, and `Help` menus.

You can add your own menu, or you can add menu items or sub-menus to the
existing menus and sub-menus. Sub-menus can be arbitrarily deep.

<Figure src="/img/top_level_menus.png" caption="In the above screenshot, the `Add` menu provides quick access to adding a view via the UI; this is a good place to consider adding your own custom view type."/>

You add menus in the `configure` method of your plugin. Not all JBrowse products
have top-level menus. Web and Desktop do, embeddable views like JBrowse Linear
View don't. Check support with `isAbstractMenuManager` in the `configure`
method, so the rest of the plugin still works if there is no menu. Here's an
example that adds an "Open My View" item to the `Add` menu.

```js
import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import InfoIcon from '@mui/icons-material/Info'

class MyPlugin extends Plugin {
  name = 'MyPlugin'

  install(pluginManager) {
    // install MyView here
  }

  configure(pluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Open My View',
        icon: InfoIcon,
        onClick: session => {
          session.addView('MyView', {})
        },
      })
    }
  }
}
```

## Adding track menu items

If you create a custom track, you can populate the track menu items using the
`trackMenuItems` view on the track model. To append items to menu items from the
base display, grab `trackMenuItems` from the extended model and redefine it:

```js
types
  .model({
    // model
  })
  .views(self => {
    // capture before the new view is defined — accessing self.trackMenuItems
    // inside the getter would recurse infinitely
    const { trackMenuItems: superTrackMenuItems } = self
    return {
      get trackMenuItems() {
        return [
          ...superTrackMenuItems(),
          {
            label: 'Menu Item',
            icon: AddIcon,
            onClick: () => {},
          },
        ]
      },
    }
  })
```

## Adding track context-menu items

When you right-click in a linear track, a context menu will appear if there are
any menu items defined for it.

<Figure src="/img/linear_align_ctx_menu.png" caption="A screenshot of a context menu available on a linear genome view track. Here, we see the context menu of a feature right-clicked on a LinearAlignmentsDisplay."/>

It's possible to add items to that menu, and items can vary by whether the click
hit a feature, and by which feature. This is done by extending the
`contextMenuItems` view of the display model via the
`Core-extendPluggableElement`
[extension point](/docs/developer_guides/extension_points). Here is an example:

```js
class SomePlugin extends Plugin {
  name = 'SomePlugin'

  install(pluginManager) {
    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearAlignmentsDisplay') {
          const { stateModel } = pluggableElement
          const newStateModel = stateModel.extend(self => {
            const superContextMenuItems = self.contextMenuItems
            return {
              views: {
                contextMenuItems() {
                  const feature = self.contextMenuFeature
                  if (!feature) {
                    // we're not adding any menu items since the click was not
                    // on a feature
                    return superContextMenuItems()
                  }
                  return [
                    ...superContextMenuItems(),
                    {
                      label: 'Some menu item',
                      icon: SomeIcon,
                      onClick: () => {
                        // do some stuff
                      },
                    },
                  ]
                },
              },
            }
          })

          pluggableElement.stateModel = newStateModel
        }
        return pluggableElement
      },
    )
  }
}
```

## MenuItems objects

You can add menus or add items to existing menus in several places.

In these different places, a `MenuItem` object defines the menu item's text,
icon, action, and other attributes.

Types of `MenuItem`s:

- Normal - a standard menu item that performs an action when clicked
- Checkbox - a menu item that has a checkbox
- Radio - a menu item that has a radio button icon
- Divider - a horizontal line (not clickable) that can be used to visually
  divide menus
- SubHeader - text (not clickable) that can be used to visually label a section
  of a menu
- SubMenu - contains menu items, for making nested menus

| Name     | Description                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type     | Options are 'normal', 'radio', 'checkbox', 'subMenu', 'subHeader', or 'divider'. If not provided, defaults to 'normal', unless a `subMenu` attribute is present, in which case it defaults to 'subMenu'. |
| label    | The text for the menu item. Not applicable to 'divider', required for all others.                                                                                                                        |
| subLabel | Additional descriptive text for the menu item. Not applicable to 'divider' or 'subHeader', optional for all others.                                                                                      |
| icon     | An icon for the menu item. Must be compatible with [MUI Icons](https://mui.com/material-ui/material-ui-icons/). Not applicable to 'divider' or 'subHeader', optional for all others.                     |
| disabled | Whether or not the menu item is disabled (meaning grayed out and not clickable). Not applicable to 'divider' or 'subHeader', optional for all others.                                                    |
| checked  | Whether or not the checkbox or radio button are selected. Only applicable to 'radio' and 'checkbox'                                                                                                      |
| onClick  | Callback of action to perform on click. Function signature is `(session) => void`. Required for 'normal', 'radio', and 'checkbox', not applicable to any others.                                         |
| subMenu  | An array of menu items. Applicable only to 'subMenu'.                                                                                                                                                    |

Here is an example array of MenuItems and the resulting menu:

```js
;[
  {
    label: 'Normal menu item',
    icon: AddIcon,
    onClick: () => {},
  },
  {
    label: 'Normal',
    subLabel: 'with subLabel',
    icon: AddIcon,
    onClick: () => {},
  },
  {
    label: 'Disabled menu item',
    disabled: true,
    icon: AddIcon,
    onClick: () => {},
  },
  {
    type: 'radio',
    label: 'Radio checked',
    checked: true,
    onClick: () => {},
  },
  {
    type: 'radio',
    label: 'Radio unchecked',
    checked: false,
    onClick: () => {},
  },
  {
    type: 'checkbox',
    label: 'Checkbox checked',
    checked: true,
    onClick: () => {},
  },
  {
    type: 'checkbox',
    label: 'Checkbox unchecked',
    checked: false,
    onClick: () => {},
  },
  { type: 'divider' },
  { type: 'subHeader', label: 'This is a subHeader' },
  {
    label: 'SubMenu',
    subMenu: [
      {
        label: 'SubMenu item one',
        onClick: () => {},
      },
      {
        label: 'SubMenu item two',
        onClick: () => {},
      },
    ],
  },
]
```

## Root model Menu API

The root model exposes actions for customizing the top-level menus at runtime,
typically called from a plugin's `configure()`, guarded by
`isAbstractMenuManager` as shown above. Each takes a `menuName`/`menuPath` and
(for the `insert*` variants) a `position` that counts from the end when
negative, and returns the new length of the affected menu. Their signatures and
descriptions are auto-generated from the model, so see the
[`RootAppMenuMixin` state model](/docs/models/rootappmenumixin) for the
authoritative reference:

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

- [Extension points](/docs/developer_guides/extension_points)
- [Custom track and display types](/docs/developer_guides/creating_display)
- [Pluggable elements](/docs/developer_guides/pluggable_elements)
