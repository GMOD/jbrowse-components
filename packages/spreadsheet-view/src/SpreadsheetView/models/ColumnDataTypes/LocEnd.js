export default ({ jbrequire }) => {
  const { types } = jbrequire('mobx-state-tree')
  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const { FilterModelType: NumberFilterModel } = jbrequire(require('./Number'))

  const FilterModelType = types.compose(
    NumberFilterModel,
    types.model({
      type: types.literal('LocEnd'),
    }),
  )

  const LocEnd = MakeSpreadsheetColumnType('LocEnd', {
    categoryName: 'Location',
    displayName: 'End',
    compare(cellA, cellB) {
      return parseFloat(cellA.text) - parseFloat(cellB.text)
    },
    FilterModelType,
  })

  return LocEnd
}
