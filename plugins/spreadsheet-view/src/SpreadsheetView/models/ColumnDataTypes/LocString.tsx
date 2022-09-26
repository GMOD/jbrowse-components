import React from 'react'
import { observer } from 'mobx-react'
import { types, getType, getParent } from 'mobx-state-tree'
import { doesIntersect2, isContainedWithin } from '@jbrowse/core/util/range'
import ClearIcon from '@mui/icons-material/Clear'
import {
  when,
  compareLocs,
  getSession,
  parseLocString,
} from '@jbrowse/core/util'
import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'

import {
  getPropertyType,
  getEnumerationValues,
  getSubType,
} from '@jbrowse/core/util/mst-reflection'

import {
  IconButton,
  TextField,
  MenuItem,
  InputAdornment,
  Select,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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
  },
)

const OPERATIONS = [
  'overlaps with',
  'contained within',
  'fully contains',
  'does not overlap',
  'not contained within',
  'does not contain',
]

interface Loc {
  start: number
  end: number
  refName: string
}

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
} as { [key: string]: (a: Loc, b: Loc) => boolean }

OPERATION_PREDICATES['does not overlap'] = (
  cellLocation,
  specifiedLocation,
) => {
  return !OPERATION_PREDICATES['overlaps with'](cellLocation, specifiedLocation)
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
        const parsed = this.parsedLocString
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = getParent<any>(self, 3).spreadsheet
      const { assemblyName } = model
      try {
        return parseLocString(self.locString, refName =>
          session.assemblyManager.isValidRefName(refName, assemblyName),
        )
      } catch (e) {
        return undefined
      }
    },
  }))
  .views(self => ({
    // returns a function that tests the given row
    get predicate() {
      const {
        locString,
        locStringIsInvalid,
        parsedLocString,
        operation,
        columnNumber,
      } = self // avoid closing over self
      if (!locString || locStringIsInvalid || !parsedLocString) {
        return function alwaysTrue() {
          return true
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return function stringPredicate(_sheet: any, row: any) {
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

        return predicate(parsedCellText, parsedLocString as Loc)
      }
    },
  }))
  .actions(self => ({
    setLocString(s: string) {
      self.locString = s
    },
    setOperation(op: string) {
      self.operation = op
    },
  }))
  .volatile(() => ({ ReactComponent: FilterReactComponent }))

// opens a new LGV at the location described in the locString in the cell text

async function locationLinkClick(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spreadsheet: any,
  _columnNumber: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cell: any,
) {
  const session = getSession(spreadsheet)
  const { assemblyManager } = session
  const { assemblyName } = spreadsheet

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { id } = getParent<any>(spreadsheet)

  try {
    const assembly = await assemblyManager.waitForAssembly(assemblyName)
    if (!assembly) {
      throw new Error(`assembly not found "${assemblyName}"`)
    }
    const loc = parseLocString(cell.text, name =>
      assemblyManager.isValidRefName(name, spreadsheet.assemblyName),
    )
    const { refName } = loc
    const canonicalRefName = assembly.getCanonicalRefName(refName)
    const newDisplayedRegion = assembly.regions?.find(
      region => region.refName === canonicalRefName,
    )

    const newViewId = `${id}_${assemblyName}`
    let view = session.views.find(v => v.id === newViewId) as LGV
    if (!view) {
      view = session.addView('LinearGenomeView', {
        displayName: assemblyName,
        id: newViewId,
      }) as LGV

      await when(() => view.initialized)

      // note that we have to clone this because otherwise it adds "same object
      // twice to the mst tree"
      view.setDisplayedRegions([JSON.parse(JSON.stringify(newDisplayedRegion))])
    }
    view.navToLocString(cell.text)
  } catch (e) {
    session.notify(`${e}`, 'error')
  }
}

const DataCellReactComponent = observer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ cell, columnNumber, spreadsheet }: any) => {
    return (
      <a
        onClick={evt => {
          evt.preventDefault()
          locationLinkClick(spreadsheet, columnNumber, cell)
        }}
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compare(cellA: { extendedData: any }, cellB: { extendedData: any }) {
    return compareLocs(cellA.extendedData, cellB.extendedData)
  },
  FilterModelType,
  DataCellReactComponent,
})

export default LocStringColumnType
