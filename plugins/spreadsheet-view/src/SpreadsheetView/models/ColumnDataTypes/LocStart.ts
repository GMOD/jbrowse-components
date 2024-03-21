import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'
import { types } from 'mobx-state-tree'
import { FilterModelType as NumberFilterModel } from './Number'

const FilterModelType = types.compose(
  NumberFilterModel,
  types.model({
    type: types.literal('LocStart'),
  }),
)

const LocStart = MakeSpreadsheetColumnType('LocStart', {
  FilterModelType,
  categoryName: 'Location',
  compare(cellA: { text: string }, cellB: { text: string }) {
    return parseFloat(cellA.text) - parseFloat(cellB.text)
  },
  displayName: 'Start',
})

export default LocStart
