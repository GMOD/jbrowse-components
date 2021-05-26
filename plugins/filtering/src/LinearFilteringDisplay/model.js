import { ConfigurationReference } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

function makeFilters(displayModel) {
  const filters = []
  const { filterOut } = displayModel
  for (const attrName of filterOut.keys()) {
    for (const value of filterOut.get(attrName).keys()) {
      if (filterOut.get(attrName).get(value)) {
        filters.push(`jexl:get(feature,'${attrName}') != '${value}'`)
      }
    }
  }
  return filters
}

export default configSchema => {
  return types.compose(
    'LinearFilteringDisplay',
    BaseLinearDisplay,
    types
      .model({
        type: types.literal('LinearFilteringDisplay'),
        configuration: ConfigurationReference(configSchema),
        hideExpressions: types.optional(types.array(types.string), () => []),
        height: 193,
        filterControlsHeight: 70,
        dragHandleHeight: 3,
        filterOut: types.map(types.map(types.boolean)), // model[attrName][value] = true if filtering out
      })
      .views(self => ({
        get renderProps() {
          const filters = makeFilters(self)
          return {
            ...getParentRenderProps(self),
            ...this.composedRenderProps,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            config: self.configuration.renderer,
            filters,
          }
        },
        get innerDisplayHeight() {
          return self.height - self.dragHandleHeight - self.filterControlsHeight
        },
        get filterControlsMinHeight() {
          return Math.min(self.filterControlsMaxHeight, 40)
        },
        get filterControlsMaxHeight() {
          return Math.max(self.height - 20, 0)
        },
        get rendererTypeName() {
          return self.configuration.renderer.type
        },
      }))
      .actions(self => ({
        setFilterControlsHeight(newHeight) {
          if (newHeight > self.filterControlsMinHeight) {
            if (newHeight < self.filterControlsMaxHeight) {
              self.filterControlsHeight = newHeight
            } else {
              self.filterControlsHeight = self.filterControlsMaxHeight
            }
          } else {
            self.filterControlsHeight = self.filterControlsMinHeight
          }
          return self.filterControlsHeight
        },
        resizeFilterControls(distance) {
          const oldHeight = self.filterControlsHeight
          const newHeight = self.setFilterControlsHeight(
            self.filterControlsHeight - distance,
          )
          return oldHeight - newHeight
        },
        toggleFilter(attrName, value, checked) {
          if (!self.filterOut.has(attrName)) {
            self.filterOut.set(attrName, {})
          }
          const values = self.filterOut.get(attrName)
          values.set(String(value), !checked)
        },
      })),
  )
}
