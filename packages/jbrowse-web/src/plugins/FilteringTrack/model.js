import { types } from 'mobx-state-tree'

import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'

import FilteringTrackComponent from './components/FilteringTrack'
import BasicTrackFactory from '../LinearGenomeView/BasicTrack'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'

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

export default pluginManager => {
  const {
    configSchema: btConfigSchema,
    stateModel: btStateModel,
  } = BasicTrackFactory(pluginManager)

  const configSchema = ConfigurationSchema(
    'FilteringTrack',
    {
      filterAttributes: {
        type: 'stringArray',
        defaultValue: ['type'],
        description: 'list of feature attributes to use for filtering',
      },
    },
    {
      baseConfiguration: btConfigSchema,
      explicitlyTyped: true,
    },
  )

  const stateModel = types.compose(
    'FilteringTrack',
    btStateModel,
    types
      .model({
        type: types.literal('FilteringTrack'),
        configuration: ConfigurationReference(configSchema),
        hideExpressions: types.optional(types.array(types.string), () => []),
        height: 193,
        filterControlHeight: 70,
        dragHandleHeight: 3,
        filterOut: types.map(types.map(types.boolean)), // model[attrName][value] = true if filtering out
      })
      .views(self => ({
        get renderProps() {
          const view = getContainingView(self)
          const filters = makeFilters(self)
          return {
            bpPerPx: view.bpPerPx,
            horizontallyFlipped: view.horizontallyFlipped,
            trackModel: self,
            config: self.configuration.renderer,
            filters,
          }
        },
        get innerTrackHeight() {
          return self.height - self.dragHandleHeight - self.filterControlHeight
        },
      }))
      .actions(self => ({
        resizeFilterControls(distance) {
          self.filterControlHeight -= distance
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
  return { configSchema, stateModel }
}
