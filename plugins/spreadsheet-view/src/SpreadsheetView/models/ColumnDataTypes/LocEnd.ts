import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'
import { FilterModelType as NumberFilterModel } from './Number'
import { types } from 'mobx-state-tree'

const FilterModelType = types.compose(
  NumberFilterModel,
  types.model({
    type: types.literal('LocEnd'),
  }),
)

const LocEnd = MakeSpreadsheetColumnType('LocEnd', {
  FilterModelType,
  categoryName: 'Location',
  compare(cellA: { text: string }, cellB: { text: string }) {
    return parseFloat(cellA.text) - parseFloat(cellB.text)
  },
  displayName: 'End',
})

export default LocEnd
