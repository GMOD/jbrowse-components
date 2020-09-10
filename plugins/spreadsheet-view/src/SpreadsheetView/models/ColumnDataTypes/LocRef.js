export default ({ jbrequire }) => {
  const { types } = jbrequire('mobx-state-tree')
  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const { FilterModelType: NumberFilterModel } = jbrequire(require('./Text'))

  const FilterModelType = types.compose(
    NumberFilterModel,
    types.model({
      type: types.literal('LocRef'),
    }),
  )

  const LocRef = MakeSpreadsheetColumnType('LocRef', {
    categoryName: 'Location',
    displayName: 'Reference seq',
    compare(cellA, cellB) {
      return cellA.text.localeCompare(cellB.text)
    },
    FilterModelType,
  })

  return LocRef
}
