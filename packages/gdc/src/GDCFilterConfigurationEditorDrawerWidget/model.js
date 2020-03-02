import { types } from 'mobx-state-tree'
import { ElementId } from '@gmod/jbrowse-core/mst-types'

const Filter = types
  .model({
    category: types.string,
    type: types.string,
    filter: types.string,
  })
  .actions(self => ({
    setCategory(newCategory) {
      self.category = newCategory
      self.filter = ''
    },
    setFilter(newFilter) {
      self.filter = newFilter
    },
  }))

export default pluginManager =>
  types
    .model('GDCFilterConfigurationEditorDrawerWidget', {
      id: ElementId,
      type: types.literal('GDCFilterConfigurationEditorDrawerWidget'),
      target: types.safeReference(
        pluginManager.pluggableConfigSchemaType('track'),
      ),
      filters: types.array(Filter),
      caseFilterCount: 0,
    })
    .actions(self => ({
      setTarget(newTarget) {
        self.target = newTarget
      },
      addFilter(id, category, type, filter) {
        self.filters.set(id, Filter.create({ category, type, filter }))
      },
      clearFilters() {
        self.filters.clear()
      },
      updateCaseFilterCount() {
        self.caseFilterCount += 1
      },
      clearCaseFilterCount() {
        self.caseFilterCount = 0
      },
    }))
