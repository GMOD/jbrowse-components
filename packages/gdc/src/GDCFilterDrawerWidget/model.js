import { ElementId } from '@gmod/jbrowse-core/util/types/mst'

export default jbrowse => {
  const { types } = jbrowse.jbrequire('mobx-state-tree')

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

  const ColourBy = types.model({
    id: types.identifier,
    value: types.string,
  })

  return types
    .model('GDCFilterDrawerWidget', {
      id: ElementId,
      type: types.literal('GDCFilterDrawerWidget'),
      target: types.safeReference(jbrowse.pluggableConfigSchemaType('track')),
      filters: types.array(Filter),
      colourBy: types.map(ColourBy),
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
      setColourBy(newColourBy) {
        self.colourBy[0] = newColourBy
      },
      getColourBy() {
        return self.colourBy[0] ? self.colourBy[0] : {}
      },
    }))
}
