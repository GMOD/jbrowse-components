export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { makeStyles } = jbrequire('@material-ui/core/styles')

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
        margin: theme.spacing(1),
        '& td': {
          border: '1px solid #d8d8d8',
          padding: '0.2rem',
        },
      },
    }
  })

  function DataTable({ columnDisplayOrder, rowSet }) {
    const classes = useStyles()
    return (
      <table className={classes.dataTable}>
        <tbody>
          {rowSet.rows.map((row, rowNumber) => (
            <tr key={rowNumber}>
              {columnDisplayOrder.map(colNumber => (
                <td key={colNumber}>
                  {row.cells.length > colNumber
                    ? row.cells[colNumber].text
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  function Spreadsheet({ model, height }) {
    const classes = useStyles()

    return (
      <div className={classes.root} style={{ height }}>
        {model && model.rowSet && model.rowSet.isLoaded ? (
          <DataTable
            columnDisplayOrder={model.columnDisplayOrder}
            rowSet={model.rowSet}
          />
        ) : (
          <div>Loading...</div>
        )}
      </div>
    )
  }
  Spreadsheet.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(Spreadsheet)
}
