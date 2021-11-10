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
  categoryName: 'Location',
  displayName: 'Reference seq',
  compare(cellA, cellB) {
    return cellA.text.localeCompare(cellB.text)
  },
  FilterModelType,
})

export default LocRef
