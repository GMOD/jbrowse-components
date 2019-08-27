import { ConfigurationReference } from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { basicTrackStateModelFactory } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import FilteringTrackComponent from './components/FilteringTrack'

function makeFilters(trackModel) {
  const filters = []
  const { filterOut } = trackModel
  for (const attrName of filterOut.keys()) {
    for (const value of filterOut.get(attrName).keys()) {
      if (filterOut.get(attrName).get(value)) {
        filters.push(
          `function(f) { return String(f.get('${attrName}')) !== '${value}'}`,
        )
      }
    }
  }
  return filters
}

export default configSchema => {
  const basicTrackStateModel = basicTrackStateModelFactory(configSchema)

  return types.compose(
    'FilteringTrack',
    basicTrackStateModel,
    types
      .model({
        type: types.literal('FilteringTrack'),
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
            trackModel: self,
            config: self.configuration.renderer,
            filters,
          }
        },
        get innerTrackHeight() {
          return self.height - self.dragHandleHeight - self.filterControlsHeight
        },
        get filterControlsMinHeight() {
          return Math.min(self.filterControlsMaxHeight, 40)
        },
        get filterControlsMaxHeight() {
          return Math.max(self.height - 20, 0)
        },
      }))
      .actions(self => ({
        setFilterControlsHeight(newHeight) {
          if (newHeight > self.filterControlsMinHeight) {
            if (newHeight < self.filterControlsMaxHeight)
              self.filterControlsHeight = newHeight
            else self.filterControlsHeight = self.filterControlsMaxHeight
          } else self.filterControlsHeight = self.filterControlsMinHeight
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
          if (!self.filterOut.has(attrName)) self.filterOut.set(attrName, {})
          const values = self.filterOut.get(attrName)
          values.set(String(value), !checked)
        },
      }))
      .volatile(() => ({
        reactComponent: FilteringTrackComponent,
      })),
  )
}
