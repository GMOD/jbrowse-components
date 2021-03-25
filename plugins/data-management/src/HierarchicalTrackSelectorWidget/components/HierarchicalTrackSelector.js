/* eslint-disable react/prop-types */
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import {
  Fab,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  makeStyles,
  Switch,
  Tab,
  Tabs,
  TextField,
} from '@material-ui/core'

import ClearIcon from '@material-ui/icons/Clear'
import AddIcon from '@material-ui/icons/Add'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'
import CloseIcon from '@material-ui/icons/Close'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState } from 'react'
import { FixedSizeTree } from 'react-vtree'

import AutoSizer from 'react-virtualized-auto-sizer'
import CloseConnectionDialog from './CloseConnectionDialog'
import DeleteConnectionDialog from './DeleteConnectionDialog'

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

// adapted from react-vtree docs
function makeTreeWalker(nodes, onChange) {
  return function* treeWalker(refresh) {
    const stack = []

    stack.push({
      nestingLevel: 0,
      node: nodes,
    })

    while (stack.length !== 0) {
      const { node, nestingLevel } = stack.pop()
      const { id, name, selected } = node
      const isOpened = yield refresh
        ? {
            id,
            isLeaf: node.children.length === 0,
            isOpenByDefault: true,
            name,
            node,
            checked: !!selected,
            nestingLevel,
            onChange,
          }
        : id

      if (node.children.length !== 0 && isOpened) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push({
            nestingLevel: nestingLevel + 1,
            node: node.children[i],
            onChange,
          })
        }
      }
    }
  }
}

const Node = ({ data, isOpen, style, toggle }) => {
  const { isLeaf, nestingLevel, checked, id, name, onChange } = data
  return (
    <div
      style={{
        ...style,
        marginLeft: nestingLevel * 10 + (isLeaf ? 10 : 0),
        width: 500,
      }}
    >
      {!isLeaf ? (
        <div onClick={toggle} role="presentation">
          {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
          {name}
        </div>
      ) : (
        <>
          <input
            id={id}
            data-testid={`htsTrackEntry-${id}`}
            type="checkbox"
            checked={checked}
            onChange={() => onChange(id)}
          />
          <label title={name} htmlFor={id}>
            {name}
          </label>
        </>
      )}
    </div>
  )
}

const Example = ({ tree, model, toolbarHeight }) => {
  return (
    <AutoSizer disableWidth>
      {({ height }) => {
        return (
          <FixedSizeTree
            treeWalker={makeTreeWalker(
              { name: 'Tracks', id: 'Tracks', children: tree },
              id => {
                model.view.toggleTrack(id)
              },
            )}
            itemSize={20}
            height={height - toolbarHeight}
            width="100%"
          >
            {Node}
          </FixedSizeTree>
        )
      }}
    </AutoSizer>
  )
}

function HierarchicalTrackSelector({ model, toolbarHeight }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const [assemblyIdx, setAssemblyIdx] = useState(0)
  const [modalInfo, setModalInfo] = useState()
  const [headerHeight, setHeaderHeight] = useState(0)
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

  function breakConnection(connectionConf, deleting = false) {
    const name = readConfObject(connectionConf, 'name')
    const result = session.prepareToBreakConnection(connectionConf)
    if (result) {
      const [safelyBreakConnection, dereferenceTypeCount] = result
      // always popup a warning if deleting or tracks are going to be removed
      // from view
      if (Object.keys(dereferenceTypeCount).length > 0 || deleting) {
        setModalInfo({
          connectionConf,
          safelyBreakConnection,
          dereferenceTypeCount,
          name,
          deleting,
        })
      } else {
        safelyBreakConnection()
      }
    } else if (deleting) {
      setModalInfo({ name, deleting, connectionConf })
    }
  }

  const { assemblyNames } = model
  const assemblyName = assemblyNames[assemblyIdx]
  if (!assemblyName) {
    return null
  }
  const trackConfigs = model.trackConfigurations(assemblyName, session.tracks)
  const filterError = trackConfigs.filter(filter).length === 0
  const nodes = model.hierarchy(assemblyNames[assemblyIdx])

  return (
    <>
      <div
        ref={ref => setHeaderHeight(ref?.getBoundingClientRect().height || 0)}
      >
        <TextField
          className={classes.searchBox}
          label="Filter tracks"
          value={model.filterText}
          error={trackConfigs.filter(filter).length === 0}
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
      </div>
      <Example
        tree={nodes}
        model={model}
        toolbarHeight={toolbarHeight + headerHeight}
      />
    </>
  )
}

HierarchicalTrackSelector.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(HierarchicalTrackSelector)
