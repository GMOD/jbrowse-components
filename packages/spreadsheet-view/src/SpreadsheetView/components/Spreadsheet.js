/* eslint-disable react/prop-types */
export function numToColName(num) {
  function letterFor(n) {
    return String.fromCharCode(n + 65)
  }
  if (num >= 0) {
    if (num < 26) {
      return letterFor(num)
    }
    if (num < 27 * 26) {
      return letterFor(Math.floor(num / 26 - 1)) + letterFor(num % 26)
    }
  }

  throw new RangeError('column number out of range')
}

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes: MobxPropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState, useRef } = React
  const ReactPropTypes = jbrequire('prop-types')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const { grey, indigo } = jbrequire('@material-ui/core/colors')
  const Checkbox = jbrequire('@material-ui/core/Checkbox')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const Icon = jbrequire('@material-ui/core/Icon')
  const Menu = jbrequire('@material-ui/core/Menu')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const ListItemIcon = jbrequire('@material-ui/core/ListItemIcon')
  const ListItemText = jbrequire('@material-ui/core/ListItemText')
  const Tooltip = jbrequire('@material-ui/core/Tooltip')
  const FormControlLabel = jbrequire('@material-ui/core/FormControlLabel')

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        background: grey[500],
        overflow: 'auto',
      },
      dataTable: {
        borderCollapse: 'collapse',
        borderSpacing: 0,
        boxSizing: 'border-box',
        '& td': {
          border: `1px solid ${grey[300]}`,
          padding: '0.2rem',
          maxWidth: 200,
          maxHeight: 200,
          overflowWrap: 'break-word',
          overflow: 'auto',
        },
      },
      dataTableBody: {
        background: 'white',
      },
      rowNumCell: {
        background: grey[200],
        textAlign: 'right',
        border: `1px solid ${grey[300]}`,
        position: 'relative',
        padding: '0 2px 0 0',
        userSelect: 'none',
      },
      rowNumber: {
        fontWeight: 'normal',
        display: 'flex',
        textAlign: 'right',
        margin: 0,
      },
      rowSelector: {
        position: 'relative',
        top: '-2px',
        margin: 0,
        padding: '0 0.2rem',
      },
      columnHead: {
        fontWeight: 'normal',
        background: grey[200],
        border: `1px solid ${grey[300]}`,
        position: 'sticky',
        top: '-1px',
        zIndex: 2,
        whiteSpace: 'nowrap',
        padding: [[0, theme.spacing(1)]],
      },
      sortIndicator: {
        position: 'relative',
        top: '0.2rem',
        fontSize: '1rem',
      },
      columnButtonContainer: {
        display: 'none',
        position: 'absolute',
        right: 0,
        top: 0,
        background: grey[100],
        height: '100%',
        boxSizing: 'border-box',
        borderLeft: `1px solid ${grey[300]}`,
      },
      columnButton: {
        padding: 0,
      },
      topLeftCorner: {
        background: grey[300],
        position: 'sticky',
        top: '-1px',
        zIndex: 2,
        minWidth: theme.spacing(2),
        textAlign: 'left',
      },
      dataRowSelected: {
        background: indigo[100],
        '& th': {
          background: indigo[100],
        },
      },
      emptyMessage: { captionSide: 'bottom' },
    }
  })

  const CellData = observer(({ cell, spreadsheetModel, columnNumber }) => {
    const { dataType } = spreadsheetModel.columns.get(columnNumber)
    if (dataType.ReactComponent) {
      return (
        <dataType.ReactComponent cell={cell} spreadsheet={spreadsheetModel} />
      )
    }

    return cell.text
  })

  const DataRow = observer(({ rowModel, rowNumber, spreadsheetModel }) => {
    const classes = useStyles()
    const { hideRowSelection, columnDisplayOrder } = spreadsheetModel
    let rowClass = classes.dataRow
    if (rowModel.isSelected) rowClass += ` ${classes.dataRowSelected}`

    const labelClick = evt => {
      rowModel.toggleSelect()
      evt.stopPropagation()
      evt.preventDefault()
    }

    return (
      <tr className={rowClass}>
        <th className={classes.rowNumCell} onClick={labelClick}>
          <FormControlLabel
            className={classes.rowNumber}
            control={
              hideRowSelection ? null : (
                <Checkbox
                  className={classes.rowSelector}
                  checked={rowModel.isSelected}
                  onClick={labelClick}
                  size="small"
                />
              )
            }
            label={rowNumber + 1}
          />
        </th>
        {columnDisplayOrder.map(colNumber => (
          <td key={colNumber}>
            {rowModel.cells.length > colNumber ? (
              <CellData
                cell={rowModel.cells[colNumber]}
                spreadsheetModel={spreadsheetModel}
                columnNumber={colNumber}
              />
            ) : null}
          </td>
        ))}
      </tr>
    )
  })

  function SortIndicator({ model, columnNumber }) {
    const classes = useStyles()
    const sortSpec = model.sortColumns.find(
      c => c.columnNumber === columnNumber,
    )

    if (sortSpec) {
      const { descending } = sortSpec
      return (
        <Icon
          fontSize="small"
          className={classes.sortIndicator}
          onClick={sortSpec.switchDirection}
        >
          {descending ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </Icon>
      )
    }
    return null
  }

  const ColumnMenu = observer(({ model, currentColumnMenu, setColumnMenu }) => {
    const columnMenuClose = () => {
      setDataTypeMenuOpen(false)
      setColumnMenu(null)
    }

    const columnNumber = currentColumnMenu && currentColumnMenu.colNumber

    const sortMenuClick = descending => {
      columnMenuClose()
      model.setSortColumns([
        {
          columnNumber,
          descending,
        },
      ])
    }

    const [dataTypeMenuOpen, setDataTypeMenuOpen] = useState(false)
    const drawerMenuItemRef = useRef(null)

    const { dataTypeChoices } = model

    const dataTypeName =
      (currentColumnMenu && model.columns[columnNumber].dataType.type) || ''
    const dataTypeDisplayName =
      (currentColumnMenu && model.columns[columnNumber].dataType.displayName) ||
      ''

    return (
      <>
        <Menu
          anchorEl={currentColumnMenu && currentColumnMenu.anchorEl}
          keepMounted
          open={Boolean(currentColumnMenu)}
          onClose={columnMenuClose}
          elevation={8}
          getContentAnchorEl={null}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={sortMenuClick.bind(null, false)}>
            <ListItemIcon>
              <Icon style={{ transform: 'scale(1,-1)' }} fontSize="small">
                sort
              </Icon>
            </ListItemIcon>
            <ListItemText primary="Sort ascending" />
          </MenuItem>
          <MenuItem onClick={sortMenuClick.bind(null, true)}>
            <ListItemIcon>
              <Icon fontSize="small">sort</Icon>
            </ListItemIcon>
            <ListItemText primary="Sort descending" />
          </MenuItem>
          <MenuItem
            ref={drawerMenuItemRef}
            onClick={() => {
              setDataTypeMenuOpen(true)
            }}
          >
            <ListItemIcon>
              <Icon fontSize="small">perm_data_setting</Icon>
            </ListItemIcon>
            <ListItemText primary={`Type: ${dataTypeDisplayName}`} />
            <ListItemIcon>
              <Icon fontSize="small">arrow_right</Icon>
            </ListItemIcon>
          </MenuItem>
        </Menu>
        <Menu
          anchorEl={
            currentColumnMenu && drawerMenuItemRef && drawerMenuItemRef.current
          }
          open={Boolean(currentColumnMenu && dataTypeMenuOpen)}
          onClose={columnMenuClose}
          elevation={10}
          getContentAnchorEl={null}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          {dataTypeChoices.map(({ typeName, displayName }) => {
            return (
              <MenuItem
                key={typeName}
                onClick={() => {
                  model.setColumnType(columnNumber, typeName)
                  columnMenuClose()
                }}
              >
                <ListItemIcon>
                  <Icon fontSize="small">
                    {dataTypeName === typeName ? 'check' : 'blank'}
                  </Icon>
                </ListItemIcon>
                <ListItemText primary={displayName || typeName} />
              </MenuItem>
            )
          })}
        </Menu>
      </>
    )
  })

  const DataTable = observer(({ model }) => {
    const { columnDisplayOrder, columns, hasColumnNames, rowSet } = model
    const classes = useStyles()

    // column menu active state
    const [currentColumnMenu, setColumnMenu] = useState(null)
    const columnButtonClick = (colNumber, evt) => {
      setColumnMenu({
        colNumber,
        anchorEl: evt.currentTarget,
      })
    }

    // column header hover state
    const [currentHoveredColumn, setHoveredColumn] = useState(null)
    const columnHeaderMouseOver = (colNumber /* , evt */) => {
      setHoveredColumn(colNumber)
    }
    const columnHeaderMouseOut = (/* colNumber, evt */) => {
      setHoveredColumn(null)
    }

    const totalRows = rowSet.count
    const rows = rowSet.sortedFilteredRows

    return (
      <>
        <ColumnMenu
          model={model}
          currentColumnMenu={currentColumnMenu}
          setColumnMenu={setColumnMenu}
        />
        <table className={classes.dataTable}>
          <thead>
            <tr>
              <th className={classes.topLeftCorner}>
                <Tooltip title="Unselect all" placement="right">
                  <IconButton
                    className={classes.unselectAllButton}
                    onClick={model.unselectAll}
                    size="small"
                  >
                    <Icon className={classes.columnButtonIcon}>crop_free</Icon>
                  </IconButton>
                </Tooltip>
              </th>
              {columnDisplayOrder.map(colNumber => (
                <th
                  className={classes.columnHead}
                  key={colNumber}
                  onMouseOver={columnHeaderMouseOver.bind(null, colNumber)}
                  onMouseOut={columnHeaderMouseOut.bind(null, colNumber)}
                >
                  <SortIndicator model={model} columnNumber={colNumber} />
                  {(hasColumnNames && columns.get(colNumber).name) ||
                    numToColName(colNumber)}
                  <div
                    className={classes.columnButtonContainer}
                    style={{
                      display:
                        currentHoveredColumn === colNumber ||
                        (currentColumnMenu &&
                          currentColumnMenu.colNumber === colNumber)
                          ? 'block'
                          : 'none',
                    }}
                  >
                    <IconButton
                      className={classes.columnButton}
                      onClick={columnButtonClick.bind(null, colNumber)}
                    >
                      <Icon className={classes.columnButtonIcon}>
                        arrow_drop_down
                      </Icon>
                    </IconButton>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={classes.dataTableBody}>
            {rows.map((row, rowNumber) => (
              <DataRow
                key={row.id}
                rowNumber={rowNumber}
                spreadsheetModel={model}
                rowModel={row}
              />
            ))}
          </tbody>
          {!rows.length ? (
            <caption className={classes.emptyMessage}>
              {totalRows ? 'no rows match criteria' : 'no rows present'}
            </caption>
          ) : null}
        </table>
      </>
    )
  })

  function Spreadsheet({ model, height }) {
    const classes = useStyles()

    return (
      <div className={classes.root} style={{ height }}>
        {model && model.rowSet && model.rowSet.isLoaded ? (
          <DataTable model={model} />
        ) : (
          <div>Loading...</div>
        )}
      </div>
    )
  }
  Spreadsheet.propTypes = {
    model: MobxPropTypes.objectOrObservableObject,
    height: ReactPropTypes.number.isRequired,
  }
  Spreadsheet.defaultProps = {
    model: undefined,
  }
  return observer(Spreadsheet)
}
