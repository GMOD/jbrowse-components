import { values } from 'mobx'
import { getRoot, onAction, types } from 'mobx-state-tree'
import React from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { DrawerWidgetType } from '../../Plugin'

const HierarchicalSelector = React.lazy(() =>
  import('./components/HierarchicalTrackSelector'),
)

const Category = types
  .model('Category', {
    id: types.identifier,
    open: types.optional(types.boolean, true),
  })
  .actions(self => ({
    toggle() {
      self.open = !self.open
    },
  }))

const stateModel = types.compose(
  'HierarchicalTrackSelectorDrawerWidget',
  types
    .model({
      id: types.identifier,
      type: types.literal('HierarchicalTrackSelectorDrawerWidget'),
      categories: types.map(Category),
    })
    .actions(self => ({
      afterAttach() {
        onAction(getRoot(self).views.filter(v => v.id === self.id)[0], call => {
          if (call.name === 'set' && call.path.endsWith('category'))
            this.addCategory(call.args[0][call.args[0].length - 1])
        })
        // If the above onAction is used to change a category for a track, there
        // might now be unused categories. This triggers a cleanup after
        // everything is done to keep unused categories from accumulating.
        onAction(
          getRoot(self).views.filter(v => v.id === self.id)[0],
          call => {
            if (call.name === 'set' && call.path.endsWith('category'))
              this.reloadCategories()
          },
          true,
        )
        this.loadCategories()
      },
      loadCategories() {
        const view = getRoot(self).views.filter(v => v.id === self.id)[0]
        values(view.tracks).forEach(track => {
          const categories = track.configuration.category.value
          const category = categories[categories.length - 1]
          if (category) this.addCategory(category)
        })
      },
      reloadCategories() {
        self.categories.clear()
        this.loadCategories()
      },
      addCategory(name) {
        if (!self.categories.has(name))
          self.categories.set(name, Category.create({ id: name }))
      },
    })),
)

export default class HierarchicalTrackSelectorDrawerWidget extends Plugin {
  install(pluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      const configSchema = ConfigurationSchema(
        'HierarchicalTrackSelectorDrawerWidget',
        {
          allCollapsed: {
            type: 'boolean',
            defaultValue: false,
          },
          allExpanded: {
            type: 'boolean',
            defaultValue: true,
          },
        },
      )

      return new DrawerWidgetType({
        name: 'HierarchicalTrackSelectorDrawerWidget',
        heading: 'Available Tracks',
        configSchema,
        stateModel,
        LazyReactComponent: HierarchicalSelector,
      })
    })
  }
}
