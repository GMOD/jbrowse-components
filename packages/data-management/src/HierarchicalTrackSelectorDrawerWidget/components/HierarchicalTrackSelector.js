import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import { makeStyles } from '@material-ui/core'
import Fab from '@material-ui/core/Fab'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputAdornment from '@material-ui/core/InputAdornment'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import Switch from '@material-ui/core/Switch'
import Tab from '@material-ui/core/Tab'
import Tabs from '@material-ui/core/Tabs'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState } from 'react'
import Contents from './Contents'

const useStyles = makeStyles(theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing(1),
  },
  searchBox: {
    marginBottom: theme.spacing(2),
  },
  fab: {
    float: 'right',
    position: 'sticky',
    marginTop: theme.spacing(2),
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
  connectionsPaper: {
    padding: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  tabs: {
    marginBottom: theme.spacing(1),
  },
}))

function HierarchicalTrackSelector({ model }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const [assemblyIdx, setAssemblyIdx] = useState(0)
  const classes = useStyles()

  const session = getSession(model)

  function handleTabChange(event, newIdx) {
    setAssemblyIdx(newIdx)
  }

  function handleFabClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleFabClose() {
    setAnchorEl(null)
  }

  function handleInputChange(event) {
    model.setFilterText(event.target.value)
  }

  function addConnection() {
    handleFabClose()
    const drawerWidget = session.addDrawerWidget(
      'AddConnectionDrawerWidget',
      'addConnectionDrawerWidget',
    )
    session.showDrawerWidget(drawerWidget)
  }

  function addTrack() {
    handleFabClose()
    const drawerWidget = session.addDrawerWidget(
      'AddTrackDrawerWidget',
      'addTrackDrawerWidget',
      { view: model.view.id },
    )
    session.showDrawerWidget(drawerWidget)
  }

  function filter(trackConfig) {
    if (!model.filterText) return true
    const name = readConfObject(trackConfig, 'name')
    return name.toLowerCase().includes(model.filterText.toLowerCase())
  }

  const { assemblyNames } = model
  const assemblyName = assemblyNames[assemblyIdx]
  if (!assemblyName) return null
  const filterError =
    model.trackConfigurations(assemblyName) > 0 &&
    model.trackConfigurations(assemblyName).filter(filter).length === 0
  const dataset = session.datasets.find(
    s => readConfObject(s, ['assembly', 'name']) === assemblyName,
  )

  return (
    <div
      key={model.view.id}
      className={classes.root}
      data-testid="hierarchical_track_selector"
    >
      {assemblyNames.length > 1 ? (
        <Tabs
          className={classes.tabs}
          value={assemblyIdx}
          onChange={handleTabChange}
        >
          {assemblyNames.map(name => (
            <Tab key={name} label={name} />
          ))}
        </Tabs>
      ) : null}
      <TextField
        className={classes.searchBox}
        label="Filter Tracks"
        value={model.filterText}
        error={filterError}
        helperText={filterError ? 'No matches' : ''}
        onChange={handleInputChange}
        fullWidth
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={model.clearFilterText}>
                <Icon>clear</Icon>
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <Contents
        model={model}
        filterPredicate={filter}
        assemblyName={assemblyName}
        top
      />
      <FormGroup>
        {dataset.connections.map(connectionConf => (
          <FormControlLabel
            key={readConfObject(connectionConf, 'name')}
            control={
              <Switch
                checked={
                  session.connections.has(assemblyName) &&
                  !!session.connections
                    .get(assemblyName)
                    .find(
                      connection =>
                        connection.name ===
                        readConfObject(connectionConf, 'name'),
                    )
                }
                onChange={() => {
                  if (
                    !(
                      session.connections.has(assemblyName) &&
                      !!session.connections
                        .get(assemblyName)
                        .find(
                          connection =>
                            connection.name ===
                            readConfObject(connectionConf, 'name'),
                        )
                    )
                  )
                    session.makeConnection(connectionConf)
                  else session.breakConnection(connectionConf)
                }}
                // value="checkedA"
              />
            }
            label={readConfObject(connectionConf, 'name')}
          />
        ))}
      </FormGroup>
      {session.connections.has(assemblyName) ? (
        <>
          <Typography variant="h5">Connections:</Typography>
          {session.connections.get(assemblyName).map(connection => (
            <Paper
              key={connection.name}
              className={classes.connectionsPaper}
              elevation={8}
            >
              <Typography variant="h6">{connection.name}</Typography>
              <Contents
                model={model}
                filterPredicate={filter}
                connection={connection}
                assemblyName={assemblyName}
                top
              />
            </Paper>
          ))}
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
        <MenuItem onClick={addConnection}>Add connection</MenuItem>
        <MenuItem onClick={addTrack}>Add track</MenuItem>
      </Menu>
    </div>
  )
}

HierarchicalTrackSelector.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(HierarchicalTrackSelector)
