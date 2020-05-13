import { types } from 'mobx-state-tree'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'

const Filter = types
  .model({
    id: types.identifier,
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
    .model('GDCFilterDrawerWidget', {
      id: ElementId,
      type: types.literal('GDCFilterDrawerWidget'),
      target: types.safeReference(
        pluginManager.pluggableConfigSchemaType('track'),
      ),
      filters: types.array(Filter),
    })
    .actions(self => ({
      setTarget(newTarget) {
        self.target = newTarget
      },
      addFilter(id, category, type, filter) {
        self.filters.push(Filter.create({ id, category, type, filter }))
      },
      deleteFilter(id) {
        const pos = self.filters.findIndex(filter => filter.id === id)
        self.filters.remove(self.filters[pos])
      },
      getFiltersByType(type) {
        return self.filters.filter(filter => {
          return filter.type === type
        })
      },
      clearFilters() {
        // Keep filters that have been added but not set
        self.filters = self.filters.filter(f => {
          return f.filter.length === 0
        })
      },
    }))
