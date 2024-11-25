import React from 'react'
import {
  getPropertyType,
  getEnumerationValues,
  getSubType,
} from '@jbrowse/core/util/mst-reflection'
import ClearIcon from '@mui/icons-material/Clear'
import {
  IconButton,
  TextField,
  MenuItem,
  InputAdornment,
  Select,
} from '@mui/material'
import { observer } from 'mobx-react'
import { types, getPropertyMembers } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'

// icons

const OPERATIONS = [
  'equals',
  'contains',
  'does not contain',
  'does not equal',
  'starts with',
  'ends with',
]

// NOTE: assembly names, if present, are ignored in all of these predicates
const OPERATION_PREDICATES = {
  contains: (textInCell, stringToFind) => {
    return textInCell.toLowerCase().includes(stringToFind)
  },
  equals: (textInCell, stringToFind) => {
    return textInCell.toLowerCase() === stringToFind
  },
  'starts with': (textInCell, stringToFind) => {
    return textInCell.toLowerCase().startsWith(stringToFind)
  },
  'ends with': (textInCell, stringToFind) => {
    const index = textInCell.toLowerCase().indexOf(stringToFind)
    if (index === -1) {
      return false
    }
    return index === textInCell.length - stringToFind.length
  },
} as Record<string, (a: string, b: string) => boolean>

OPERATION_PREDICATES['does not contain'] = (textInCell, stringToFind) => {
  return !OPERATION_PREDICATES.contains!(textInCell, stringToFind)
}
OPERATION_PREDICATES['does not equal'] = (textInCell, stringToFind) => {
  return !OPERATION_PREDICATES.equals!(textInCell, stringToFind)
}

const useStyles = makeStyles()({
  textFilterControlAdornment: { marginRight: '-18px' },
  textFilterControl: {
    margin: 0,
    '& .MuiInput-formControl': {
      marginTop: 8,
    },
    '& .MuiInputLabel-formControl': {
      top: '-7px',
      '&.MuiInputLabel-shrink': {
        top: '-3px',
      },
    },
  },
})

// React component for the column filter control
const FilterReactComponent = observer(
  ({ filterModel }: { filterModel: any }) => {
    const { classes } = useStyles()
    const operationChoices = getEnumerationValues(
      getSubType(getPropertyType(getPropertyMembers(filterModel), 'operation')),
    )
    return (
      <>
        <Select
          value={filterModel.operation}
          onChange={event => {
            filterModel.setOperation(String(event.target.value))
          }}
        >
          {operationChoices.map(name => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </Select>{' '}
        <TextField
          label="text"
          value={filterModel.stringToFind}
          onChange={evt => filterModel.setString(evt.target.value)}
          className={classes.textFilterControl}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment
                  className={classes.textFilterControlAdornment}
                  position="end"
                >
                  <IconButton
                    aria-label="clear filter"
                    onClick={() => filterModel.setString('')}
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </>
    )
  },
)

// MST model for the column filter control
const ColumnTextFilter = types
  .model('ColumnTextFilter', {
    type: types.literal('Text'),
    columnNumber: types.integer,
    stringToFind: '',
    operation: types.optional(types.enumeration(OPERATIONS), OPERATIONS[0]!),
  })
  .views(self => ({
    // returns a function that tests the given row
    get predicate() {
      const { stringToFind, columnNumber, operation } = self // avoid closing over self
      if (!stringToFind) {
        return function alwaysTrue() {
          return true
        }
      }
      const s = stringToFind.toLowerCase() // case insensitive match

      return function stringPredicate(_sheet: any, row: any) {
        const { cellsWithDerived } = row
        const cell = cellsWithDerived[columnNumber]
        if (!cell?.text) {
          return false
        }
        const predicate = OPERATION_PREDICATES[operation]
        if (!predicate) {
          throw new Error(`"${operation}" not implemented in location filter`)
        }
        return predicate(cell.text, s)
      }
    },
  }))
  .actions(self => ({
    setString(s: string) {
      self.stringToFind = s
    },
    setOperation(op: string) {
      self.operation = op
    },
  }))
  .volatile(() => ({ ReactComponent: FilterReactComponent }))

const TextColumnType = MakeSpreadsheetColumnType('Text', {
  compare(cellA: { text: string }, cellB: { text: string }) {
    return cellA.text.localeCompare(cellB.text)
  },
  FilterModelType: ColumnTextFilter,
})

export { TextColumnType as TextColumn, ColumnTextFilter as FilterModelType }
