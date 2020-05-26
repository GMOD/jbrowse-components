import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import CropFreeIcon from '@material-ui/icons/CropFree'
import ArrowDropDown from '@material-ui/icons/ArrowDropDown'

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
  const { useState } = React
  const ReactPropTypes = jbrequire('prop-types')
  const { getParent } = jbrequire('mobx-state-tree')

  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const { grey, indigo } = jbrequire('@material-ui/core/colors')
  const Checkbox = jbrequire('@material-ui/core/Checkbox')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const Tooltip = jbrequire('@material-ui/core/Tooltip')
  const FormControlLabel = jbrequire('@material-ui/core/FormControlLabel')

  const ColumnMenu = jbrequire(require('./ColumnMenu'))
  const RowMenu = jbrequire(require('./RowMenu'))

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
          maxWidth: '50em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      },
      dataTableBody: {
        background: 'white',
      },
      rowNumCell: {
        background: grey[200],
        textAlign: 'left',
        border: `1px solid ${grey[300]}`,
        position: 'relative',
        padding: '0 2px 0 0',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      },
      rowNumber: {
        fontWeight: 'normal',
        display: 'inline-block',
        flex: 'none',
        paddingRight: '20px',
        margin: 0,
        whiteSpace: 'nowrap',
      },
      rowMenuButton: {
        padding: 0,
        margin: 0,
        position: 'absolute',
        right: 0,
        display: 'inline-block',
        whiteSpace: 'nowrap',
        flex: 'none',
      },
      rowMenuButtonIcon: {},
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
    if (dataType.DataCellReactComponent) {
      return (
        <dataType.DataCellReactComponent
          cell={cell}
          dataType={dataType}
          columnNumber={columnNumber}
          spreadsheet={spreadsheetModel}
        />
      )
    }

    return cell.text
  })

  const DataRow = observer(({ rowModel, rowNumber, spreadsheetModel }) => {
    const classes = useStyles()
    const { hideRowSelection, columnDisplayOrder } = spreadsheetModel
    let rowClass = classes.dataRow
    if (rowModel.isSelected) rowClass += ` ${classes.dataRowSelected}`

    function labelClick(evt) {
      rowModel.toggleSelect()
      evt.stopPropagation()
      evt.preventDefault()
    }

    function rowButtonClick(event) {
      spreadsheetModel.setRowMenuPosition({
        anchorEl: event.currentTarget,
        rowNumber,
      })
      event.preventDefault()
      event.stopPropagation()
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
            label={rowModel.id}
          />
          <IconButton
            className={classes.rowMenuButton}
            onClick={rowButtonClick}
            color="secondary"
          >
            <ArrowDropDown className={classes.rowMenuButtonIcon} />
          </IconButton>
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
      return descending ? (
        <KeyboardArrowUpIcon
          fontSize="small"
          className={classes.sortIndicator}
        />
      ) : (
        <KeyboardArrowDownIcon
          fontSize="small"
          className={classes.sortIndicator}
        />
      )
    }
    return null
  }

  const DataTableBody = observer(({ rows, spreadsheetModel }) => {
    const classes = useStyles()
    return (
      <tbody className={classes.dataTableBody}>
        {rows.map(row => (
          <DataRow
            key={row.id}
            rowNumber={row.id}
            spreadsheetModel={spreadsheetModel}
            rowModel={row}
          />
        ))}
      </tbody>
    )
  })

  const DataTable = observer(({ model }) => {
    const { columnDisplayOrder, columns, hasColumnNames, rowSet } = model
    const classes = useStyles()

    // column menu active state
    const [currentColumnMenu, setColumnMenu] = useState(null)
    function columnButtonClick(colNumber, evt) {
      setColumnMenu({
        colNumber,
        anchorEl: evt.currentTarget,
      })
    }

    // column header hover state
    const [currentHoveredColumn, setHoveredColumn] = useState(null)
    function columnHeaderMouseOver(colNumber /* , evt */) {
      setHoveredColumn(colNumber)
    }
    function columnHeaderMouseOut(/* colNumber, evt */) {
      setHoveredColumn(null)
    }

    const totalRows = rowSet.count
    const rows = rowSet.sortedFilteredRows

    return (
      <>
        <ColumnMenu
          viewModel={getParent(model)}
          spreadsheetModel={model}
          currentColumnMenu={currentColumnMenu}
          setColumnMenu={setColumnMenu}
        />
        <RowMenu viewModel={getParent(model)} spreadsheetModel={model} />
        <table className={classes.dataTable}>
          <thead>
            <tr>
              <th className={classes.topLeftCorner}>
                <Tooltip title="Unselect all" placement="right">
                  <span>
                    <IconButton
                      className={classes.unselectAllButton}
                      onClick={model.unselectAll}
                      disabled={!model.rowSet.selectedCount}
                      size="small"
                      color="secondary"
                    >
                      <CropFreeIcon className={classes.columnButtonIcon} />
                    </IconButton>
                  </span>
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
                      color="secondary"
                    >
                      <ArrowDropDown className={classes.columnButtonIcon} />
                    </IconButton>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <DataTableBody rows={rows} spreadsheetModel={model} />
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
