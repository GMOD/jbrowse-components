export default ({ jbrequire }) => {
  const { types } = jbrequire('mobx-state-tree')
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')

  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const TextField = jbrequire('@material-ui/core/TextField')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const Select = jbrequire('@material-ui/core/Select')

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
      return numberInCell > firstNumber && numberInCell < secondNumber
    },
  }
  OPERATION_PREDICATES['not between'] = (
    numberInCell,
    firstNumber,
    secondNumber,
  ) => {
    return !OPERATION_PREDICATES.between(
      numberInCell,
      firstNumber,
      secondNumber,
    )
  }

  const useStyles = makeStyles((/* theme */) => {
    return {
      textFilterControlAdornment: { marginRight: '-18px' },
      textFilterControl: {
        margin: [[0, 0, 0, '0.4rem']],
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
    }
  })

  // React component for the column filter control
  const FilterReactComponent = observer(({ filterModel }) => {
    const classes = useStyles()

    const operationChoices = OPERATIONS

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
          label="number"
          placeholder="123"
          type="number"
          error={filterModel.firstNumberIsInvalid}
          defaultValue={filterModel.firstNumber}
          onChange={evt => {
            filterModel.setFirstNumber(parseFloat(evt.target.value))
          }}
          className={classes.textFilterControl}
          margin="dense"
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
              margin="dense"
            />
          </>
        )}
      </>
    )
  })

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
        if (typeof self.firstNumber !== 'number')
          return function alwaysTrue() {
            return true
          }

        const { firstNumber, secondNumber, operation, columnNumber } = self // avoid closing over self
        return function stringPredicate(sheet, row) {
          const { cells } = row
          const cell = cells[columnNumber]

          if (!cell || !cell.text) return false

          const parsedCellText = parseFloat(cell.text)
          if (typeof parsedCellText !== 'number') return false

          const predicate = OPERATION_PREDICATES[operation]
          if (!predicate)
            throw new Error(`"${operation}" not implemented in location filter`)

          return predicate(parsedCellText, firstNumber, secondNumber)
        }
      },
    }))
    .actions(self => ({
      setFirstNumber(n) {
        if (isNaN(n) || typeof n !== 'number') self.firstNumber = undefined
        else self.firstNumber = n
      },
      setSecondNumber(n) {
        if (isNaN(n) || typeof n !== 'number') self.secondNumber = undefined
        else self.secondNumber = n
      },
      setOperation(op) {
        self.operation = op
      },
    }))
    .volatile(() => ({ ReactComponent: FilterReactComponent }))

  const NumberColumn = MakeSpreadsheetColumnType('Number', {
    compare(cellA, cellB) {
      return parseFloat(cellA.text) - parseFloat(cellB.text)
    },
    FilterModelType,
  })

  return { NumberColumn, FilterModelType }
}
