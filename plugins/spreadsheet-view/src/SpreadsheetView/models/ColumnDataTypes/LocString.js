import { doesIntersect2, isContainedWithin } from '@jbrowse/core/util/range'
import ClearIcon from '@material-ui/icons/Clear'
import { when } from '@jbrowse/core/util'
import MakeSpreadsheetColumnTypeFactory from './MakeSpreadsheetColumnType'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getType, getParent } = jbrequire('mobx-state-tree')
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')

  const { getPropertyType, getEnumerationValues, getSubType } = jbrequire(
    '@jbrowse/core/util/mst-reflection',
  )

  const { compareLocs, getSession, parseLocString } =
    jbrequire('@jbrowse/core/util')

  const MakeSpreadsheetColumnType = jbrequire(MakeSpreadsheetColumnTypeFactory)

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
            !parsed ||
            parsed.refName === '' ||
            typeof parsed.start !== 'number' ||
            typeof parsed.end !== 'number' ||
            parsed.start > parsed.end
          )
        }
        return false
      },
      get parsedLocString() {
        const session = getSession(self)
        const model = getParent(self, 3).spreadsheet
        const { assemblyName } = model
        try {
          return parseLocString(self.locString, refName =>
            session.assemblyManager.isValidRefName(refName, assemblyName),
          )
        } catch (e) {
          return undefined
        }
      },
      // returns a function that tests the given row
      get predicate() {
        if (!self.locString || self.locStringIsInvalid) {
          return function alwaysTrue() {
            return true
          }
        }

        const { parsedLocString, operation, columnNumber } = self // avoid closing over self
        return function stringPredicate(sheet, row) {
          const { cellsWithDerived: cells } = row
          const cell = cells[columnNumber]

          if (!cell || !cell.text || !cell.extendedData) {
            return false
          }
          const parsedCellText = cell.extendedData
          if (!parsedCellText.refName) {
            return false
          }

          const predicate = OPERATION_PREDICATES[operation]
          if (!predicate) {
            throw new Error(`"${operation}" not implemented in location filter`)
          }

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
    const session = getSession(spreadsheet)
    const { assemblyManager } = session
    const { assemblyName } = spreadsheet
    const { id } = getParent(spreadsheet)
    const assembly = await assemblyManager.waitForAssembly(assemblyName)
    try {
      const loc = parseLocString(cell.text, name =>
        assemblyManager.isValidRefName(name, spreadsheet.assemblyName),
      )
      const { refName } = loc
      const canonicalRefName = assembly.getCanonicalRefName(refName)
      const newDisplayedRegion = assembly.regions.find(
        region => region.refName === canonicalRefName,
      )

      const newViewId = `${id}_${assemblyName}`
      let view = session.views.find(v => v.id === newViewId)
      if (!view) {
        view = session.addView('LinearGenomeView', {
          displayName: assemblyName,
          id: newViewId,
        })
        await when(() => view.initialized)

        // note that we have to clone this because otherwise it adds "same object
        // twice to the mst tree"
        view.setDisplayedRegions([
          JSON.parse(JSON.stringify(newDisplayedRegion)),
        ])
      }
      view.navToLocString(cell.text)
    } catch (e) {
      session.notify(`${e}`, 'error')
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
      return compareLocs(cellA.extendedData, cellB.extendedData)
    },
    FilterModelType,
    DataCellReactComponent,
  })

  return LocStringColumnType
}
