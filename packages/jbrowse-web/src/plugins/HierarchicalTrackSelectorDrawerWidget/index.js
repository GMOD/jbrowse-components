import React from 'react'
import { types } from 'mobx-state-tree'
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
      addCategory(name) {
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
