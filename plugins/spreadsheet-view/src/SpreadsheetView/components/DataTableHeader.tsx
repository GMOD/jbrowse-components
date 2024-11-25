import React, { useState } from 'react'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import CropFreeIcon from '@mui/icons-material/CropFree'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import ColumnMenu from './ColumnMenu'
import SortIndicator from './SortIndicator'
import { numToColName } from './util'
import type { SpreadsheetModel } from '../models/Spreadsheet'

interface ColMenu {
  colNumber: number
  anchorEl: HTMLElement
}

const useStyles = makeStyles()(theme => ({
  columnHead: {
    fontWeight: 'normal',
    background: theme.palette.mode === 'dark' ? '#333' : '#eee',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    whiteSpace: 'nowrap',
  },

  columnButtonContainer: {
    display: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    background: theme.palette.background.paper,
    height: '100%',
  },

  topLeftCorner: {
    background: theme.palette.mode === 'dark' ? '#333' : '#eee',
    zIndex: 2,
    position: 'sticky',
    top: 0,
    minWidth: theme.spacing(2),
    textAlign: 'left',
  },
}))

const DataTableHeader = observer(function ({
  model,
}: {
  model: SpreadsheetModel
}) {
  const { classes } = useStyles()
  const { columnDisplayOrder, columns, hasColumnNames, rowSet } = model
  const [currentColumnMenu, setColumnMenu] = useState<ColMenu>()
  const [currentHoveredColumn, setHoveredColumn] = useState<number>()

  return (
    <>
      <thead>
        <tr>
          <th className={classes.topLeftCorner}>
            <Tooltip title="Unselect all" placement="right">
              <span>
                <IconButton
                  onClick={() => {
                    model.unselectAll()
                  }}
                  disabled={!rowSet.selectedCount}
                >
                  <CropFreeIcon />
                </IconButton>
              </span>
            </Tooltip>
          </th>
          {columnDisplayOrder.map(colNumber => (
            <th
              className={classes.columnHead}
              key={colNumber}
              onMouseOver={() => {
                setHoveredColumn(colNumber)
              }}
              onMouseOut={() => {
                setHoveredColumn(undefined)
              }}
            >
              <SortIndicator model={model} columnNumber={colNumber} />
              {(hasColumnNames && columns[colNumber]!.name) ||
                numToColName(colNumber)}
              <div
                className={classes.columnButtonContainer}
                style={{
                  display:
                    currentHoveredColumn === colNumber ||
                    currentColumnMenu?.colNumber === colNumber
                      ? 'block'
                      : 'none',
                }}
              >
                <IconButton
                  onClick={evt => {
                    setColumnMenu({
                      colNumber,
                      anchorEl: evt.currentTarget,
                    })
                  }}
                >
                  <ArrowDropDown />
                </IconButton>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <ColumnMenu
        viewModel={getParent(model)}
        spreadsheetModel={model}
        currentColumnMenu={currentColumnMenu}
        setColumnMenu={setColumnMenu}
      />
    </>
  )
})

export default DataTableHeader
