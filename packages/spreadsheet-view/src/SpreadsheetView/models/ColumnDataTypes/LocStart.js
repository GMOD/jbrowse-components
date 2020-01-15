export default ({ jbrequire }) => {
  const { types } = jbrequire('mobx-state-tree')
  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const { FilterModelType: NumberFilterModel } = jbrequire(require('./Number'))

  const FilterModelType = types.compose(
    NumberFilterModel,
    types.model({
      type: types.literal('LocStart'),
    }),
  )

  const LocStart = MakeSpreadsheetColumnType('LocStart', {
    categoryName: 'Location',
    displayName: 'Start',
    compare(cellA, cellB) {
      return parseFloat(cellA.text) - parseFloat(cellB.text)
    },
    FilterModelType,
  })

  return LocStart
}
