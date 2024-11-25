import { types } from 'mobx-state-tree'
import LocEnd from './LocEnd'
import LocRef from './LocRef'
import LocStart from './LocStart'
import LocString from './LocString'
import { NumberColumn } from './Number'
import { TextColumn as Text } from './Text'
import type { IAnyModelType } from 'mobx-state-tree'

const ColumnTypes = {
  Number: NumberColumn,
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
      return FilterModelType as unknown as IAnyModelType | undefined
    })
    // some column types might not have filter machinery, filter those out
    .filter(t => !!t),
)

export { ColumnTypes, AnyColumnType, AnyFilterModelType }
