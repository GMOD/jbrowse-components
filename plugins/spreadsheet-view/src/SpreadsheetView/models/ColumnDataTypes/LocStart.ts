import { types } from 'mobx-state-tree'
import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'
import { FilterModelType as NumberFilterModel } from './Number'

const FilterModelType = types.compose(
  NumberFilterModel,
  types.model({
    type: types.literal('LocStart'),
  }),
)

const LocStart = MakeSpreadsheetColumnType('LocStart', {
  categoryName: 'Location',
  displayName: 'Start',
  compare(cellA: { text: string }, cellB: { text: string }) {
    return Number.parseFloat(cellA.text) - Number.parseFloat(cellB.text)
  },
  FilterModelType,
})

export default LocStart
