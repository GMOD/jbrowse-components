import FilterIcon from '@material-ui/icons/FilterList'
import CloseIcon from '@material-ui/icons/Close'
/* eslint-disable react/prop-types */
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import React from 'react'
import { Grid, IconButton, Typography, makeStyles } from '@material-ui/core'

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
    if (!columnDefinition) {
      throw new Error('no column definition! filters are probably out of date')
    }
    return (
      <Grid
        container
        direction="row"
        className={classes.columnFilter}
        style={{ height }}
      >
        <Grid item className={classes.filterIconBg}>
          <FilterIcon className={classes.filterIcon} />
        </Grid>
        <Grid item>
          <IconButton
            onClick={removeFilter}
            title="remove filter"
            color="secondary"
          >
            <CloseIcon />
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

export default ColumnFilterControls
