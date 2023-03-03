import React from 'react'
import { types } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import { MenuItem, Select, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'

const OPERATIONS = [
  'equals',
  'greater than',
  'less than',
  'between',
  'not between',
]

// NOTE: assembly names, if present, are ignored in all of these predicates
const OPERATION_PREDICATES = {
  equals: (numberInCell, firstNumber) => {
    return numberInCell === firstNumber
  },
  'greater than': (numberInCell, firstNumber) => {
    return numberInCell > firstNumber
  },
  'less than': (numberInCell, firstNumber) => {
    return numberInCell < firstNumber
  },
  between: (numberInCell, firstNumber, secondNumber) => {
    return (
      numberInCell > firstNumber &&
      secondNumber !== undefined &&
      numberInCell < secondNumber
    )
  },
} as { [key: string]: (arg0: number, a: number, b?: number) => boolean }

OPERATION_PREDICATES['not between'] = (
  numberInCell,
  firstNumber,
  secondNumber,
) => {
  return !OPERATION_PREDICATES.between(numberInCell, firstNumber, secondNumber)
}

const useStyles = makeStyles()({
  textFilterControlAdornment: { marginRight: '-18px' },
  textFilterControl: {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ filterModel }: { filterModel: any }) => {
    const { classes } = useStyles()

    const operationChoices = OPERATIONS

    return (
      <>
        <Select
          value={filterModel.operation}
          onChange={e => filterModel.setOperation(String(e.target.value))}
        >
          {operationChoices.map(name => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </Select>{' '}
        <TextField
          label="number"
          placeholder="123"
          type="number"
          error={filterModel.firstNumberIsInvalid}
          defaultValue={filterModel.firstNumber}
          onChange={evt => {
            filterModel.setFirstNumber(parseFloat(evt.target.value))
          }}
          className={classes.textFilterControl}
        />
        {filterModel.operation !== 'between' &&
        filterModel.operation !== 'not between' ? null : (
          <>
            {' and '}
            <TextField
              label="number"
              placeholder="456"
              type="number"
              error={filterModel.secondNumberIsInvalid}
              defaultValue={filterModel.secondNumber}
              onChange={evt =>
                filterModel.setSecondNumber(parseFloat(evt.target.value))
              }
              className={classes.textFilterControl}
            />
          </>
        )}
      </>
    )
  },
)

// MST model for the column filter control
const FilterModelType = types
  .model('ColumnNumberFilter', {
    type: types.literal('Number'),
    columnNumber: types.integer,
    firstNumber: types.maybe(types.number),
    secondNumber: types.maybe(types.number),
    operation: types.optional(types.enumeration(OPERATIONS), OPERATIONS[0]),
  })
  .views(self => ({
    // returns a function that tests the given row
    get predicate() {
      if (typeof self.firstNumber !== 'number') {
        return function alwaysTrue() {
          return true
        }
      }

      const { firstNumber, secondNumber, operation, columnNumber } = self // avoid closing over self

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return function stringPredicate(_sheet: any, row: any) {
        const { cellsWithDerived } = row
        const cell = cellsWithDerived[columnNumber]

        if (!cell || !cell.text) {
          return false
        }

        const parsedCellText = parseFloat(cell.text)
        if (typeof parsedCellText !== 'number') {
          return false
        }

        const predicate = OPERATION_PREDICATES[operation]
        if (!predicate) {
          throw new Error(`"${operation}" not implemented in location filter`)
        }

        return predicate(parsedCellText, firstNumber, secondNumber)
      }
    },
  }))
  .actions(self => ({
    setFirstNumber(n: number) {
      self.firstNumber =
        Number.isNaN(n) || typeof n !== 'number' ? undefined : n
    },
    setSecondNumber(n: number) {
      self.secondNumber =
        Number.isNaN(n) || typeof n !== 'number' ? undefined : n
    },
    setOperation(op: string) {
      self.operation = op
    },
  }))
  .volatile(() => ({ ReactComponent: FilterReactComponent }))

const NumberColumn = MakeSpreadsheetColumnType('Number', {
  compare(cellA: { text: string }, cellB: { text: string }) {
    return parseFloat(cellA.text) - parseFloat(cellB.text)
  },
  FilterModelType,
})

export { NumberColumn, FilterModelType }
