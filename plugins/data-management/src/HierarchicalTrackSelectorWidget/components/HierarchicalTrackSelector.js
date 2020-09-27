/* eslint-disable react/prop-types */
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Fab from '@material-ui/core/Fab'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import IconButton from '@material-ui/core/IconButton'
import InputAdornment from '@material-ui/core/InputAdornment'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import Switch from '@material-ui/core/Switch'
import Tab from '@material-ui/core/Tab'
import Tabs from '@material-ui/core/Tabs'
import TextField from '@material-ui/core/TextField'
import ClearIcon from '@material-ui/icons/Clear'
import AddIcon from '@material-ui/icons/Add'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useRef, useEffect, useState } from 'react'
import Tree, { selectors } from 'react-virtualized-tree'

const { getNodeRenderOptions, updateNode } = selectors

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
const SELECT = 3
const EXPAND = 4

// this is copied from the react-virtualized-tree Expandable renderer
const Expandable = ({ onChange, node, children, index }) => {
  const { hasChildren, isExpanded } = getNodeRenderOptions(node)
  const { state = {} } = node
  const { selected } = state
  const handleChange = () => {
    onChange({
      ...updateNode(node, { expanded: !isExpanded }),
      index,
      type: EXPAND,
    })
  }

  return (
    <span>
      {hasChildren && isExpanded ? (
        <div onClick={handleChange} role="presentation">
          <ArrowDropDownIcon style={{ height: 16 }} />
          {children}
        </div>
      ) : null}
      {hasChildren && !isExpanded ? (
        <div onClick={handleChange} role="presentation">
          <ArrowRightIcon style={{ height: 16 }} />
          {children}
        </div>
      ) : null}
      {!hasChildren ? (
        <>
          <input
            id={children}
            type="checkbox"
            checked={!!selected}
            onChange={() => {
              onChange({
                node: {
                  ...node,
                  state: {
                    ...state,
                    selected: !selected,
                  },
                },
                type: SELECT,
              })
            }}
          />
          <label htmlFor={children}>{children}</label>
        </>
      ) : null}
    </span>
  )
}

function HierarchicalTrackSelector({ model }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const [assemblyIdx, setAssemblyIdx] = useState(0)
  const [modalInfo, setModalInfo] = useState()
  const [height, setHeight] = useState(0)
  const ref = useRef(null)
  const classes = useStyles()
  const session = getSession(model)
  const [windowHeight, setWindowHeight] = useState(window.innerHeight)
  useEffect(() => {
    if (ref.current) {
      const h = windowHeight - ref.current.getBoundingClientRect().top
      setHeight(h - 10) // little fudge factor to avoid an outer scroll (only the virtualized container gets a scroll)
    }
  }, [windowHeight])

  useEffect(() => {
    const watcher = () => setWindowHeight(window.innerHeight)
    window.addEventListener('resize', watcher)
    return () => {
      window.removeEventListener('resize', watcher)
    }
  }, [])

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
    const widget = session.addWidget(
      'AddConnectionWidget',
      'addConnectionWidget',
    )
    session.showWidget(widget)
  }

  function addTrack() {
    handleFabClose()
    const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
      view: model.view.id,
    })
    session.showWidget(widget)
  }

  function filter(trackConfig) {
    if (!model.filterText) return true
    const name = readConfObject(trackConfig, 'name')
    return name.toLowerCase().includes(model.filterText.toLowerCase())
  }

  function handleConnectionToggle(connectionConf) {
    const assemblyConnections = session.connectionInstances.get(assemblyName)
    const existingConnection =
      assemblyConnections &&
      !!assemblyConnections.find(
        connection =>
          connection.name === readConfObject(connectionConf, 'name'),
      )
    if (existingConnection) {
      breakConnection(connectionConf)
    } else {
      session.makeConnection(connectionConf)
    }
  }

  function breakConnection(connectionConf) {
    const name = readConfObject(connectionConf, 'name')
    const [
      safelyBreakConnection,
      dereferenceTypeCount,
    ] = session.prepareToBreakConnection(connectionConf)
    if (Object.keys(dereferenceTypeCount).length > 0) {
      setModalInfo({ safelyBreakConnection, dereferenceTypeCount, name })
    } else {
      safelyBreakConnection()
    }
  }

  const { assemblyNames } = model
  const assemblyName = assemblyNames[assemblyIdx]
  if (!assemblyName) {
    return null
  }
  const filterError =
    model.trackConfigurations(assemblyName) > 0 &&
    model.trackConfigurations(assemblyName).filter(filter).length === 0
  const nodes = model.hierarchy(assemblyNames[assemblyIdx])

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
              <IconButton color="secondary" onClick={model.clearFilterText}>
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <div ref={ref} style={{ height }}>
        <Tree
          nodes={nodes}
          onChange={() => {}}
          extensions={{
            updateTypeHandlers: {
              [SELECT]: (n, updatedNode) => {
                model.view.toggleTrack(updatedNode.conf)
                return n
              },
              [EXPAND]: (n, updatedNode) => {
                model.toggleCategory(updatedNode.id, updatedNode.state.expanded)
                return n
              },
            },
          }}
        >
          {({ style, node, ...rest }) => {
            return (
              <span style={style}>
                <Expandable node={node} {...rest}>
                  {node.name}
                </Expandable>
              </span>
            )
          }}
        </Tree>
      </div>
      <FormGroup>
        {session.connections
          .filter(
            connectionConf =>
              readConfObject(connectionConf, 'assemblyName') === assemblyName,
          )
          .map(connectionConf => (
            <FormControlLabel
              key={connectionConf.connectionId}
              control={
                <Switch
                  checked={
                    session.connectionInstances.has(assemblyName) &&
                    !!session.connectionInstances
                      .get(assemblyName)
                      .find(
                        connection =>
                          connection.name ===
                          readConfObject(connectionConf, 'name'),
                      )
                  }
                  onChange={() => handleConnectionToggle(connectionConf)}
                  // value="checkedA"
                />
              }
              label={readConfObject(connectionConf, 'name')}
            />
          ))}
      </FormGroup>

      {session.editConfiguration ? (
        <Fab color="secondary" className={classes.fab} onClick={handleFabClick}>
          <AddIcon />
        </Fab>
      ) : null}
      <Menu
        id="simple-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleFabClose}
      >
        <MenuItem onClick={addConnection}>Add connection</MenuItem>
        <MenuItem onClick={addTrack}>Add track</MenuItem>
      </Menu>
      <Dialog
        aria-labelledby="connection-modal-title"
        aria-describedby="connection-modal-description"
        open={Boolean(modalInfo)}
      >
        <DialogTitle>
          Close connection &quot;{modalInfo && modalInfo.name}&quot;
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Closing this connection will close:
          </DialogContentText>
          {modalInfo ? (
            <List>
              {Object.entries(modalInfo.dereferenceTypeCount).map(
                ([key, value]) => (
                  <ListItem key={key}>{`${value} ${key}`}</ListItem>
                ),
              )}
            </List>
          ) : null}
          <DialogContentText>Are you sure you want to close?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setModalInfo()
            }}
            color="primary"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={
              modalInfo
                ? () => {
                    modalInfo.safelyBreakConnection()
                    setModalInfo()
                  }
                : () => {}
            }
            color="primary"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

HierarchicalTrackSelector.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(HierarchicalTrackSelector)
