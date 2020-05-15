import {
  doesIntersect2,
  isContainedWithin,
} from '@gmod/jbrowse-core/util/range'
import ClearIcon from '@material-ui/icons/Clear'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getType, getParent, getRoot } = jbrequire('mobx-state-tree')
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')

  const { getPropertyType, getEnumerationValues, getSubType } = jbrequire(
    '@gmod/jbrowse-core/util/mst-reflection',
  )

  const {
    compareLocStrings,
    getSession,
    parseLocStringAndConvertToInterbase,
  } = jbrequire('@gmod/jbrowse-core/util')

  const { readConfObject } = jbrequire('@gmod/jbrowse-core/configuration')

  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const TextField = jbrequire('@material-ui/core/TextField')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const InputAdornment = jbrequire('@material-ui/core/InputAdornment')
  const Select = jbrequire('@material-ui/core/Select')

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
    const operationChoices = getEnumerationValues(
      getSubType(getPropertyType(getType(filterModel), 'operation')),
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
          label="range"
          placeholder="chr1:100-200"
          error={filterModel.locStringIsInvalid}
          value={filterModel.locString}
          onChange={evt => filterModel.setLocString(evt.target.value)}
          className={classes.textFilterControl}
          margin="dense"
          InputProps={{
            endAdornment: (
              <InputAdornment
                className={classes.textFilterControlAdornment}
                position="end"
              >
                <IconButton
                  aria-label="clear filter"
                  onClick={() => filterModel.setLocString('')}
                  color="secondary"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </>
    )
  })

  const OPERATIONS = [
    'overlaps with',
    'contained within',
    'fully contains',

    'does not overlap',
    'not contained within',
    'does not contain',
  ]

  // NOTE: assembly names, if present, are ignored in all of these predicates
  const OPERATION_PREDICATES = {
    'overlaps with': (cellLocation, specifiedLocation) => {
      return (
        cellLocation.refName === specifiedLocation.refName &&
        doesIntersect2(
          cellLocation.start,
          cellLocation.end,
          specifiedLocation.start,
          specifiedLocation.end,
        )
      )
    },
    'contained within': (cellLocation, specifiedLocation) => {
      return (
        cellLocation.refName === specifiedLocation.refName &&
        isContainedWithin(
          cellLocation.start,
          cellLocation.end,
          specifiedLocation.start,
          specifiedLocation.end,
        )
      )
    },
    'fully contains': (cellLocation, specifiedLocation) => {
      return (
        cellLocation.refName === specifiedLocation.refName &&
        isContainedWithin(
          specifiedLocation.start,
          specifiedLocation.end,
          cellLocation.start,
          cellLocation.end,
        )
      )
    },
  }
  OPERATION_PREDICATES['does not overlap'] = (
    cellLocation,
    specifiedLocation,
  ) => {
    return !OPERATION_PREDICATES['overlaps with'](
      cellLocation,
      specifiedLocation,
    )
  }
  OPERATION_PREDICATES['not contained within'] = (
    cellLocation,
    specifiedLocation,
  ) => {
    return !OPERATION_PREDICATES['contained within'](
      cellLocation,
      specifiedLocation,
    )
  }
  OPERATION_PREDICATES['does not contain'] = (
    cellLocation,
    specifiedLocation,
  ) => {
    return !OPERATION_PREDICATES['fully contains'](
      cellLocation,
      specifiedLocation,
    )
  }

  // MST model for the column filter control
  const FilterModelType = types
    .model('ColumnLocStringFilter', {
      type: types.literal('LocString'),
      columnNumber: types.integer,
      locString: '',
      operation: types.optional(types.enumeration(OPERATIONS), OPERATIONS[0]),
    })
    .views(self => ({
      get locStringIsInvalid() {
        if (self.locString) {
          const parsed = self.parsedLocString
          return (
            parsed.refName === '' ||
            typeof parsed.start !== 'number' ||
            typeof parsed.end !== 'number' ||
            parsed.start > parsed.end
          )
        }
        return false
      },
      get parsedLocString() {
        return parseLocStringAndConvertToInterbase(self.locString)
      },
      // returns a function that tests the given row
      get predicate() {
        if (!self.locString || self.locStringIsInvalid)
          return function alwaysTrue() {
            return true
          }

        const { parsedLocString, operation, columnNumber } = self // avoid closing over self
        return function stringPredicate(sheet, row) {
          const { cells } = row
          const cell = cells[columnNumber]

          if (!cell || !cell.text) return false

          const parsedCellText = parseLocStringAndConvertToInterbase(cell.text)
          if (!parsedCellText.refName) return false

          const predicate = OPERATION_PREDICATES[operation]
          if (!predicate)
            throw new Error(`"${operation}" not implemented in location filter`)

          return predicate(parsedCellText, parsedLocString)
        }
      },
    }))
    .actions(self => ({
      setLocString(s) {
        self.locString = s
      },
      setOperation(op) {
        self.operation = op
      },
    }))
    .volatile(() => ({ ReactComponent: FilterReactComponent }))

  // opens a new LGV at the location described in the locString in the cell text
  async function locationLinkClick(spreadsheet, columnNumber, cell) {
    const loc = parseLocStringAndConvertToInterbase(cell.text)
    if (loc) {
      const session = getSession(spreadsheet)
      const root = getRoot(session)
      const { dataset } = getParent(spreadsheet)
      loc.refName = await root.jbrowse.getCanonicalRefName(
        loc.refName,
        readConfObject(dataset.assembly, 'name'),
      )
      const initialState = { displayName: cell.text }
      const view = session.addViewOfDataset(
        'LinearGenomeView',
        readConfObject(dataset, 'name'),
        initialState,
      )
      view.afterDisplayedRegionsSet(() => view.navTo(loc))
    }
  }

  const DataCellReactComponent = observer(
    ({ cell, columnNumber, spreadsheet }) => {
      function click(evt) {
        evt.preventDefault()
        locationLinkClick(spreadsheet, columnNumber, cell)
      }
      return (
        <a
          onClick={click}
          title="open a new linear genome view here"
          href="#link"
        >
          {cell.text}
        </a>
      )
    },
  )

  const LocStringColumnType = MakeSpreadsheetColumnType('LocString', {
    categoryName: 'Location',
    displayName: 'Full location',
    compare(cellA, cellB) {
      return compareLocStrings(cellA.text, cellB.text)
    },
    FilterModelType,
    DataCellReactComponent,
  })

  return LocStringColumnType
}
