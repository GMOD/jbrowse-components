import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'
import { FilterModelType as NumberFilterModel } from './Text'
import { types } from 'mobx-state-tree'

const FilterModelType = types.compose(
  NumberFilterModel,
  types.model({
    type: types.literal('LocRef'),
  }),
)

const LocRef = MakeSpreadsheetColumnType('LocRef', {
  FilterModelType,
  categoryName: 'Location',
  compare(cellA: { text: string }, cellB: { text: string }) {
    return cellA.text.localeCompare(cellB.text)
  },
  displayName: 'Reference seq',
})

export default LocRef
