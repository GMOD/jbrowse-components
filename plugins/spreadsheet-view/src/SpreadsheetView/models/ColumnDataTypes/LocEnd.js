import MakeSpreadsheetColumnTypeFactory from './MakeSpreadsheetColumnType'
import NumberFactory from './Number'

export default ({ jbrequire }) => {
  const { types } = jbrequire('mobx-state-tree')
  const MakeSpreadsheetColumnType = jbrequire(MakeSpreadsheetColumnTypeFactory)

  const { FilterModelType: NumberFilterModel } = jbrequire(NumberFactory)

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
