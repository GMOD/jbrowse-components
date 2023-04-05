---
id: modifying_menus
title: Modifying JBrowse menus
---

import Figure from '../figure'

### Adding a top-level menu

These are the menus that appear in the top bar of JBrowse Web and JBrowse
Desktop. By default, there are `File`, `Add`, `Tools`, and `Help` menus.

You can add your own menu, or you can add menu items or sub-menus to the
existing menus and sub-menus. Sub-menus can be arbitrarily deep.

<Figure src="/img/top_level_menus.png" caption="In the above screenshot, the `Add` menu provides quick access to adding a view via the UI; this is a good place to consider adding your own custom view type."/>

You add menus in the `configure` method of your plugin. Not all JBrowse products
will have top-level menus, though. JBrowse Web and JBrowse Desktop have them,
but something like JBrowse Linear View (which is an just a single view designed
to be embedded in another page) does not. This means you need to check whether
or not menus are supported using `isAbstractMenuManager` in the `configure`
method. This way the rest of the plugin will still work if there is not a menu.
Here's an example that adds an "Open My View" item to the `Add` menu.

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

This example uses `rootModel.appendToMenu`. See
[top-level menu API](/docs/api_guide#rootmodel-menu-api) for more details on
available functions.

### Adding menu items to a custom track

If you create a custom track, you can populate the track menu items in it using
the `trackMenuItems` property in the track model. For example:

```js
types
  .model({
    // model
  })
  .views(self => ({
    trackMenuItems() {
      return [
        {
          label: 'Menu Item',
          icon: AddIcon,
          onClick: () => {},
        },
      ]
    },
  }))
```

If you'd prefer to append your track menu items onto menu items available from
the base display, you can grab the `trackMenuItems` property from the extended
model and redefine trackMenuItems with your new Menu Item appended at the end,
like so:

```js
types
  .model({
    // model
  })
  .views(self => {
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

### Adding track context-menu items

When you right-click in a linear track, a context menu will appear if there are
any menu items defined for it.

<Figure src="/img/linear_align_ctx_menu.png" caption="A screenshot of a context menu available on a linear genome view track. Here, we see the context menu of a feature right-clicked on a LinearAlignmentsDisplay."/>

It's possible to add items to that menu, and you can also have different menu
items based on if the click was on a feature or not, and based on what feature
is clicked. This is done by extending the `contextMenuItems` view of the display
model. Here is an example:

```js
class SomePlugin extends Plugin {
  name = 'SomePlugin'

  install(pluginManager) {
    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearPileupDisplay') {
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
