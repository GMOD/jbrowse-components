import React from 'react'
import {
  doesIntersect2,
  isContainedWithin,
  compareLocs,
  getSession,
  parseLocString,
} from '@jbrowse/core/util'
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
import { types, getParent, getPropertyMembers } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// jbrowse imports

// icons

// locals
import MakeSpreadsheetColumnType from './MakeSpreadsheetColumnType'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
const FilterReactComponent = observer(function ({
  filterModel,
}: {
  filterModel: any
}) {
  const { classes } = useStyles()
  const operationChoices = getEnumerationValues(
    getSubType(getPropertyType(getPropertyMembers(filterModel), 'operation')),
  )
  return (
    <>
      <Select
        value={filterModel.operation}
        onChange={event => filterModel.setOperation(String(event.target.value))}
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
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment
                className={classes.textFilterControlAdornment}
                position="end"
              >
                <IconButton
                  aria-label="clear filter"
                  onClick={() => filterModel.setLocString('')}
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
})

const OPERATIONS = [
  'overlaps with',
  'contained within',
  'fully contains',
  'does not overlap',
  'not contained within',
  'does not contain',
] as const

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
} as Record<string, (a: Loc, b: Loc) => boolean>

OPERATION_PREDICATES['does not overlap'] = (
  cellLocation,
  specifiedLocation,
) => {
  return !OPERATION_PREDICATES['overlaps with']!(
    cellLocation,
    specifiedLocation,
  )
}
OPERATION_PREDICATES['not contained within'] = (
  cellLocation,
  specifiedLocation,
) => {
  return !OPERATION_PREDICATES['contained within']!(
    cellLocation,
    specifiedLocation,
  )
}
OPERATION_PREDICATES['does not contain'] = (
  cellLocation,
  specifiedLocation,
) => {
  return !OPERATION_PREDICATES['fully contains']!(
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
    operation: types.optional(types.string, OPERATIONS[0]),
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

      return function stringPredicate(_sheet: any, row: any) {
        const { cellsWithDerived: cells } = row
        const cell = cells[columnNumber]

        if (!cell?.text || !cell.extendedData) {
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
  spreadsheet: any,
  _columnNumber: number,

  cell: any,
) {
  const session = getSession(spreadsheet)
  const { assemblyName } = spreadsheet

  const { id } = getParent<any>(spreadsheet)

  const newViewId = `${id}_${assemblyName}`
  let view = session.views.find(v => v.id === newViewId) as LGV | undefined
  if (!view) {
    view = session.addView('LinearGenomeView', {
      id: newViewId,
    }) as LGV
  }
  await view.navToLocString(cell.text, assemblyName)
}

type DataCell = any

const DataCellReactComponent = observer(function ({
  cell,
  columnNumber,
  spreadsheet,
}: DataCell) {
  return (
    <a
      onClick={async evt => {
        evt.preventDefault()
        const session = getSession(spreadsheet)
        try {
          await locationLinkClick(spreadsheet, columnNumber, cell)
        } catch (e) {
          console.error(e)
          session.notifyError(`${e}`, e)
        }
      }}
      title="open a new linear genome view here"
      href="#"
    >
      {cell.text}
    </a>
  )
})

const LocStringColumnType = MakeSpreadsheetColumnType('LocString', {
  categoryName: 'Location',
  displayName: 'Full location',

  compare(cellA: { extendedData: any }, cellB: { extendedData: any }) {
    return compareLocs(cellA.extendedData, cellB.extendedData)
  },
  FilterModelType,
  DataCellReactComponent,
})

export default LocStringColumnType
