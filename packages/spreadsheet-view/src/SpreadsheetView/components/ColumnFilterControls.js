export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes: MobxPropTypes } = jbrequire('mobx-react')
  const { getParent, getType } = jbrequire('mobx-state-tree')
  const React = jbrequire('react')
  const { useState, useRef } = React

  const { makeStyles } = jbrequire('@material-ui/core/styles')

  const Container = jbrequire('@material-ui/core/Container')
  const Grid = jbrequire('@material-ui/core/Grid')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const Icon = jbrequire('@material-ui/core/Icon')
  const Typography = jbrequire('@material-ui/core/Typography')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const ListItemText = jbrequire('@material-ui/core/ListItemText')
  const Select = jbrequire('@material-ui/core/Select')

  const useStyles = makeStyles(theme => {
    return {
      columnName: { verticalAlign: 'middle', paddingRight: '0.3em' },
      columnFilter: {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        width: '100%',
        position: 'relative',
      },
      filterIcon: { position: 'relative', top: '12px' },
      filterIconBg: {
        background: theme.palette.tertiary.main,
        color: 'white',
        padding: [[0, theme.spacing(1.5)]],
      },
    }
  })

  function FilterOperations({ filterModel }) {
    if (filterModel) {
      return <filterModel.ReactComponent filterModel={filterModel} />
    }
    return null
  }

  const ColumnFilterControls = observer(
    ({ viewModel, filterModel, columnNumber, height }) => {
      const classes = useStyles()

      const removeFilter = () => {
        const filterControls = getParent(filterModel, 2)
        filterControls.removeColumnFilter(filterModel)
      }

      const columnDefinition = viewModel.spreadsheet.columns[columnNumber]

      return (
        <Grid
          container
          direction="row"
          className={classes.columnFilter}
          style={{ height }}
        >
          <Grid item className={classes.filterIconBg}>
            <Icon className={classes.filterIcon} fontSize="small">
              filter_list
            </Icon>
          </Grid>
          <Grid item>
            <IconButton
              onClick={removeFilter}
              title="remove filter"
              color="secondary"
            >
              <Icon fontSize="small">close</Icon>
            </IconButton>
            <Typography className={classes.columnName} component="span">
              {columnDefinition.name}
            </Typography>{' '}
            <FilterOperations filterModel={filterModel} />
          </Grid>
        </Grid>
      )
    },
  )

  return ColumnFilterControls
}
