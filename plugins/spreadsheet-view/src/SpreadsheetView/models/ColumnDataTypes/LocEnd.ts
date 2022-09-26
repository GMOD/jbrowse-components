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
  categoryName: 'Location',
  displayName: 'End',
  compare(cellA: { text: string }, cellB: { text: string }) {
    return parseFloat(cellA.text) - parseFloat(cellB.text)
  },
  FilterModelType,
})

export default LocEnd
