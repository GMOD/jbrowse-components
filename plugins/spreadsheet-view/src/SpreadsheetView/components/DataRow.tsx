import React from 'react'
import { Checkbox, IconButton, FormControlLabel } from '@mui/material'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import { indigo } from '@mui/material/colors'
import { makeStyles } from 'tss-react/mui'

// icons
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'

// locals
import SpreadsheetStateModel from '../models/Spreadsheet'
import RowStateModel from '../models/Row'
import CellData from './CellData'

type SpreadsheetModel = Instance<typeof SpreadsheetStateModel>
type RowModel = Instance<typeof RowStateModel>

const useStyles = makeStyles()(theme => ({
  dataRowSelected: {
    '& th': {
      background: indigo[100],
    },
    background: indigo[100],
  },
  rowMenuButton: {
    display: 'inline-block',
    flex: 'none',
    margin: 0,
    padding: 0,
    position: 'absolute',
    right: 0,
    whiteSpace: 'nowrap',
  },
  rowMenuButtonIcon: {},
  rowNumCell: {
    border: `1px solid ${theme.palette.action.disabledBackground}`,
    padding: '0 2px 0 0',
    position: 'relative',
    textAlign: 'left',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  rowNumber: {
    display: 'inline-block',
    flex: 'none',
    fontWeight: 'normal',
    margin: 0,
    paddingRight: '20px',
    whiteSpace: 'nowrap',
  },

  rowSelector: {
    margin: 0,
    padding: '0 0.2rem',
    position: 'relative',
    top: '-2px',
  },
}))

const DataRow = observer(function ({
  rowModel,
  rowNumber,
  spreadsheetModel,
}: {
  rowModel: RowModel
  rowNumber: string
  spreadsheetModel: SpreadsheetModel
}) {
  const { classes } = useStyles()
  const { hideRowSelection, columnDisplayOrder } = spreadsheetModel
  let rowClass = ''
  if (rowModel.isSelected) {
    rowClass += `${classes.dataRowSelected}`
  }

  function labelClick(evt: React.MouseEvent) {
    rowModel.toggleSelect()
    evt.stopPropagation()
    evt.preventDefault()
  }

  return (
    <tr className={rowClass}>
      <td className={classes.rowNumCell} onClick={labelClick}>
        {hideRowSelection ? (
          <FormControlLabel
            className={classes.rowNumber}
            control={
              <Checkbox
                className={classes.rowSelector}
                checked={rowModel.isSelected}
                onClick={labelClick}
              />
            }
            label={rowModel.id}
          />
        ) : null}
        <IconButton
          className={classes.rowMenuButton}
          onClick={event => {
            spreadsheetModel.setRowMenuPosition({
              anchorEl: event.currentTarget,
              rowNumber,
            })
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <ArrowDropDown className={classes.rowMenuButtonIcon} />
        </IconButton>
      </td>
      {columnDisplayOrder.map(colNumber => (
        <td key={colNumber}>
          <CellData
            cell={rowModel.cellsWithDerived[colNumber]}
            spreadsheetModel={spreadsheetModel}
            columnNumber={colNumber}
          />
        </td>
      ))}
    </tr>
  )
})

export default DataRow
