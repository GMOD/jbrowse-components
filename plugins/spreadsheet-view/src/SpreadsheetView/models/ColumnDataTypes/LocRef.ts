import { types } from 'mobx-state-tree'
import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'
import { FilterModelType as NumberFilterModel } from './Text'

const FilterModelType = types.compose(
  NumberFilterModel,
  types.model({
    type: types.literal('LocRef'),
  }),
)

const LocRef = MakeSpreadsheetColumnType('LocRef', {
  categoryName: 'Location',
  displayName: 'Reference seq',
  compare(cellA: { text: string }, cellB: { text: string }) {
    return cellA.text.localeCompare(cellB.text)
  },
  FilterModelType,
})

export default LocRef
