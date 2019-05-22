import Fab from '@material-ui/core/Fab'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputAdornment from '@material-ui/core/InputAdornment'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import { withStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import { getRoot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React, { useState } from 'react'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import Contents from './Contents'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
  searchBox: {
    marginBottom: theme.spacing.unit * 2,
  },
  fab: {
    float: 'right',
    position: 'sticky',
    marginTop: theme.spacing.unit * 2,
    bottom: theme.spacing.unit * 2,
    right: theme.spacing.unit * 2,
  },
  connectionsPaper: {
    padding: theme.spacing.unit,
    marginTop: theme.spacing.unit,
  },
})

function HierarchicalTrackSelector(props) {
  const [anchorEl, setAnchorEl] = useState(null)

  const { model, classes } = props
  const rootModel = getRoot(model)

  function handleFabClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleFabClose() {
    setAnchorEl(null)
  }

  function handleInputChange(event) {
    model.setFilterText(event.target.value)
  }

  function addDataHub() {
    handleFabClose()
    if (!rootModel.drawerWidgets.get('dataHubDrawerWidget'))
      rootModel.addDrawerWidget('DataHubDrawerWidget', 'dataHubDrawerWidget')
    rootModel.showDrawerWidget(
      rootModel.drawerWidgets.get('dataHubDrawerWidget'),
    )
  }

  function addTrack() {
    handleFabClose()
    rootModel.addDrawerWidget('AddTrackDrawerWidget', 'addTrackDrawerWidget', {
      view: model.view.id,
    })
    rootModel.showDrawerWidget(
      rootModel.drawerWidgets.get('addTrackDrawerWidget'),
    )
  }

  function filter(trackConfig) {
    if (!model.filterText) return true
    const name = readConfObject(trackConfig, 'name')
    return name.toLowerCase().includes(model.filterText.toLowerCase())
  }

  const filterError = model.trackConfigurations.filter(filter).length === 0

  return (
    <div key={model.view.id} className={classes.root}>
      <TextField
        className={classes.searchBox}
        label="Filter Tracks"
        value={model.filterText}
        error={filterError}
        helperText={filterError ? 'No matches' : ''}
        onChange={handleInputChange}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Icon>search</Icon>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={model.clearFilterText}>
                <Icon>clear</Icon>
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <Contents model={model} filterPredicate={filter} top />
      {rootModel.configuration.volatile.size ? (
        <>
          <Typography variant="h5">Connections:</Typography>
          {Array.from(rootModel.configuration.volatile.keys()).map(
            connectionName => (
              <Paper
                key={connectionName}
                className={classes.connectionsPaper}
                elevation={8}
              >
                <Typography variant="h6">{connectionName}</Typography>
                <Contents
                  model={model}
                  filterPredicate={filter}
                  connection={connectionName}
                  top
                />
              </Paper>
            ),
          )}
        </>
      ) : null}

      <Fab color="secondary" className={classes.fab} onClick={handleFabClick}>
        <Icon>add</Icon>
      </Fab>
      <Menu
        id="simple-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleFabClose}
      >
        <MenuItem onClick={addDataHub}>Add Data Hub</MenuItem>
        <MenuItem onClick={addTrack}>Add track</MenuItem>
      </Menu>
    </div>
  )
}

HierarchicalTrackSelector.propTypes = {
  classes: propTypes.objectOf(propTypes.string).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(HierarchicalTrackSelector))
