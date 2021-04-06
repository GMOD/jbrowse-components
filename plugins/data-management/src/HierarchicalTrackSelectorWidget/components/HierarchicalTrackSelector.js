/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import {
  Fab,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  makeStyles,
  TextField,
} from '@material-ui/core'

// icons
import ClearIcon from '@material-ui/icons/Clear'
import AddIcon from '@material-ui/icons/Add'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'
import MenuIcon from '@material-ui/icons/Menu'

// other
import { getSession } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import { observer } from 'mobx-react'
import { FixedSizeTree } from 'react-vtree'
import AutoSizer from 'react-virtualized-auto-sizer'

import CloseConnectionDialog from './CloseConnectionDialog'
import DeleteConnectionDialog from './DeleteConnectionDialog'
import ManageConnectionsDialog from './ManageConnectionsDialog'

const useStyles = makeStyles(theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing(1),
  },
  searchBox: {
    margin: theme.spacing(2),
  },
  menuIcon: {
    margin: theme.spacing(2),
  },
  fab: {
    position: 'absolute',
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

// An individual node in the track selector. Note: manually sets cursor: pointer
// improves usability for what can be clicked
const Node = ({ data, isOpen, style, toggle }) => {
  const { isLeaf, nestingLevel, checked, id, name, onChange } = data
  return (
    <div
      style={{
        ...style,
        marginLeft: nestingLevel * 10 + (isLeaf ? 10 : 0),
        whiteSpace: 'nowrap',

        // interesting note: width:100% here dynamically makes window wider
        // while scrolling for long track labels, which means we don't need
        // long track label wrapping necessarily
        width: '100%',
      }}
    >
      {!isLeaf ? (
        <div onClick={toggle} role="presentation" style={{ cursor: 'pointer' }}>
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
            style={{ cursor: 'pointer' }}
            onChange={() => onChange(id)}
          />
          <label title={name} htmlFor={id} style={{ cursor: 'pointer' }}>
            {name}
          </label>
        </>
      )}
    </div>
  )
}
// this is the main tree component for the hierarchical track selector in note:
// in jbrowse-web the toolbar is position="sticky" which means the autosizer
// includes the height of the toolbar, so we subtract the given offsets
const HierarchicalTree = ({ tree, model, offset }) => {
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
            height={height - offset}
            width="100%"
          >
            {Node}
          </FixedSizeTree>
        )
      }}
    </AutoSizer>
  )
}

const Wrapper = ({ overrideDimensions, children }) => {
  return overrideDimensions ? (
    <div style={{ ...overrideDimensions }}>{children}</div>
  ) : (
    <>{children}</>
  )
}
const HierarchicalTrackSelectorContainer = observer(
  ({ model, toolbarHeight, overrideDimensions }) => {
    const classes = useStyles()
    const session = getSession(model)
    const [anchorEl, setAnchorEl] = useState(null)

    function handleFabClose() {
      setAnchorEl(null)
    }
    return (
      <Wrapper overrideDimensions={overrideDimensions}>
        <HierarchicalTrackSelector
          model={model}
          toolbarHeight={toolbarHeight}
          overrideDimensions={overrideDimensions}
        />
        <Fab
          color="secondary"
          className={classes.fab}
          onClick={event => {
            setAnchorEl(event.currentTarget)
          }}
        >
          <AddIcon />
        </Fab>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem
            onClick={() => {
              handleFabClose()
              const widget = session.addWidget(
                'AddConnectionWidget',
                'addConnectionWidget',
              )
              session.showWidget(widget)
            }}
          >
            Add connection
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleFabClose()
              const widget = session.addWidget(
                'AddTrackWidget',
                'addTrackWidget',
                {
                  view: model.view.id,
                },
              )
              session.showWidget(widget)
            }}
          >
            Add track
          </MenuItem>
        </Menu>
      </Wrapper>
    )
  },
)

const HierarchicalTrackSelectorHeader = observer(
  ({ model, setHeaderHeight, setAssemblyIdx, assemblyIdx }) => {
    const classes = useStyles()
    const session = getSession(model)
    const [anchorEl, setAnchorEl] = useState()
    const [modalInfo, setModalInfo] = useState()
    const [connectionManagerOpen, setConnectionManagerOpen] = useState(false)
    const { assemblyNames } = model
    const assemblyName = assemblyNames[assemblyIdx]

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
      const result = session.prepareToBreakConnection(connectionConf)
      if (result) {
        const [safelyBreakConnection, dereferenceTypeCount] = result
        if (Object.keys(dereferenceTypeCount).length > 0) {
          setModalInfo({
            connectionConf,
            safelyBreakConnection,
            dereferenceTypeCount,
            name,
          })
        } else {
          safelyBreakConnection()
        }
      }
    }

    const connections = session.connections
      .filter(conf => readConfObject(conf, 'assemblyName') === assemblyName)
      .map(conf => {
        const name = readConfObject(conf, 'name')
        return {
          label: name,
          type: 'checkbox',
          checked:
            session.connectionInstances.has(assemblyName) &&
            !!session.connectionInstances
              .get(assemblyName)
              .find(connection => connection.name === name),
          onClick: () => {
            handleConnectionToggle(conf)
          },
        }
      })
    const connectionMenuItems = connections.length
      ? [
          {
            label: 'Connections...',
            subMenu: connections,
          },
          {
            label: 'Manage connections',
            onClick: () => setConnectionManagerOpen(true),
          },
        ]
      : []
    const assemblyMenuItems =
      assemblyNames.length > 2
        ? [
            {
              label: 'Assemblies...',
              subMenu: assemblyNames.map((name, idx) => ({
                label: name,
                onClick: () => {
                  setAssemblyIdx(idx)
                },
              })),
            },
          ]
        : []

    const menuItems = [...connectionMenuItems, ...assemblyMenuItems]
    return (
      <div
        ref={ref => setHeaderHeight(ref?.getBoundingClientRect().height || 0)}
      >
        <div style={{ display: 'flex' }}>
          {
            /*
             * if there are no connections and not a multi-assembly drop down
             * menu here may be unneeded and cause more confusion than help,  so
             * conditionally renders
             */
            menuItems.length ? (
              <IconButton
                className={classes.menuIcon}
                onClick={event => {
                  setAnchorEl(event.currentTarget)
                }}
              >
                <MenuIcon />
              </IconButton>
            ) : null
          }
          <TextField
            className={classes.searchBox}
            label="Filter tracks"
            value={model.filterText}
            onChange={event => model.setFilterText(event.target.value)}
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

        <JBrowseMenu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onMenuItemClick={(_, callback) => {
            callback()
            setAnchorEl(undefined)
          }}
          onClose={() => {
            setAnchorEl(undefined)
          }}
          menuItems={menuItems}
        />
        {modalInfo ? (
          <CloseConnectionDialog
            modalInfo={modalInfo}
            setModalInfo={setModalInfo}
            session={session}
          />
        ) : null}
        {connectionManagerOpen ? (
          <ManageConnectionsDialog
            modelInfo={modalInfo}
            setModalInfo={setModalInfo}
            handleClose={() => setConnectionManagerOpen(false)}
            breakConnection={breakConnection}
            session={session}
          />
        ) : null}
      </div>
    )
  },
)
const HierarchicalTrackSelector = observer(({ model, toolbarHeight = 0 }) => {
  const [assemblyIdx, setAssemblyIdx] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)

  const { assemblyNames } = model
  const assemblyName = assemblyNames[assemblyIdx]
  if (!assemblyName) {
    return null
  }
  const nodes = model.hierarchy(assemblyNames[assemblyIdx])

  return (
    <>
      <HierarchicalTrackSelectorHeader
        model={model}
        setHeaderHeight={setHeaderHeight}
        setAssemblyIdx={setAssemblyIdx}
        assemblyIdx={assemblyIdx}
      />
      <HierarchicalTree
        tree={nodes}
        model={model}
        offset={toolbarHeight + headerHeight}
      />
    </>
  )
})

export default HierarchicalTrackSelectorContainer
