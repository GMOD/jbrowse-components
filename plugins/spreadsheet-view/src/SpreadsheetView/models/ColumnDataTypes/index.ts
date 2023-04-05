import LocString from './LocString'
import LocRef from './LocRef'
import LocStart from './LocStart'
import LocEnd from './LocEnd'
import { NumberColumn as Number } from './Number'
import { TextColumn as Text } from './Text'
import { types, IAnyModelType } from 'mobx-state-tree'

const ColumnTypes = {
  Number,
  Text,
  LocString,
  LocRef,
  LocStart,
  LocEnd,
}

const allColumnTypes = Object.values(ColumnTypes)
const AnyColumnType = types.union(...allColumnTypes)
const AnyFilterModelType = types.union(
  ...allColumnTypes
    .map(columnType => {
      // just instantiate the blank types to get their filter model types
      const { FilterModelType } = columnType.create({
        // @ts-expect-error
        type: columnType.properties.type.value,
      })
      return FilterModelType as unknown as IAnyModelType
    })
    // some column types might not have filter machinery, filter those out
    .filter(t => !!t),
)

export { ColumnTypes, AnyColumnType, AnyFilterModelType }
