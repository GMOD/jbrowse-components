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
  const ReactPropTypes = jbrequire('prop-types')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const { grey, indigo } = jbrequire('@material-ui/core/colors')
  const Checkbox = jbrequire('@material-ui/core/Checkbox')

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        background: 'white',
        overflow: 'auto',
      },
      dataTable: {
        borderCollapse: 'collapse',
        borderSpacing: 0,
        boxSizing: 'border-box',
        '& td': {
          border: `1px solid ${grey[300]}`,
          padding: '0.2rem',
        },
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
      },
      rowSelector: {
        position: 'absolute',
        top: 1,
        left: 0,
        margin: 0,
        padding: 0,
      },
      columnLetter: {
        fontWeight: 'normal',
        background: grey[200],
        border: `1px solid ${grey[300]}`,
      },
      topLeftCorner: {
        background: grey[300],
      },
      dataRowSelected: {
        background: indigo[100],
        '& th': {
          background: indigo[100],
        },
      },
    }
  })

  const DataRow = observer(({ rowModel, rowNumber, spreadsheetModel }) => {
    const classes = useStyles()
    const { hideRowSelection, columnDisplayOrder } = spreadsheetModel
    let rowClass = classes.dataRow
    if (rowModel.isSelected) rowClass += ` ${classes.dataRowSelected}`
    return (
      <tr className={rowClass}>
        <th className={classes.rowNumCell}>
          <label
            className={classes.rowNumber}
            style={{ paddingLeft: hideRowSelection ? undefined : '23px' }}
          >
            {hideRowSelection ? null : (
              <Checkbox
                className={classes.rowSelector}
                checked={rowModel.isSelected}
                onClick={rowModel.toggleSelect}
                size="small"
              />
            )}
            {rowNumber + 1}
          </label>
        </th>
        {columnDisplayOrder.map(colNumber => (
          <td key={colNumber}>
            {rowModel.cells.length > colNumber
              ? rowModel.cells[colNumber].text
              : null}
          </td>
        ))}
      </tr>
    )
  })

  const DataTable = observer(({ model }) => {
    const { columnDisplayOrder, columnNames, rowSet } = model
    const classes = useStyles()
    return (
      <table className={classes.dataTable}>
        <thead>
          <tr>
            <th className={classes.topLeftCorner}></th>
            {columnDisplayOrder.map(colNumber => (
              <th className={classes.columnLetter} key={colNumber}>
                {columnNames[colNumber] || numToColName(colNumber)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowSet.rows.map((row, rowNumber) => (
            <DataRow
              key={rowNumber}
              rowNumber={rowNumber}
              spreadsheetModel={model}
              rowModel={row}
            />
          ))}
        </tbody>
      </table>
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
