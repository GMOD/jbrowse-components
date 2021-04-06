/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import {
  Fab,
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

// icons
import ClearIcon from '@material-ui/icons/Clear'
import AddIcon from '@material-ui/icons/Add'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'
import CloseIcon from '@material-ui/icons/Close'

// other
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
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
        whiteSpace: 'nowrap',
        width: '100%',
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

const Example = ({ tree, model, offset }) => {
  // in JBrowse-web the toolbar is position="sticky" which means the autosizer includes the height of the toolbar, so we subtract the given offsets
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

    function addConnection() {
      setAnchorEl(null)
      const widget = session.addWidget(
        'AddConnectionWidget',
        'addConnectionWidget',
      )
      session.showWidget(widget)
    }

    function addTrack() {
      setAnchorEl(null)
      const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
        view: model.view.id,
      })
      session.showWidget(widget)
    }
    return (
      <Wrapper overrideDimensions={overrideDimensions}>
        <HierarchicalTrackSelector
          model={model}
          toolbarHeight={toolbarHeight}
          overrideDimensions={overrideDimensions}
        />

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={addConnection}>Add connection</MenuItem>
          <MenuItem onClick={addTrack}>Add track</MenuItem>
        </Menu>
      </Wrapper>
    )
  },
)

//   function handleTabChange(event, newIdx) {
//     setAssemblyIdx(newIdx)
//   }

//   function handleConnectionToggle(connectionConf) {
//     const assemblyConnections = session.connectionInstances.get(assemblyName)
//     const existingConnection =
//       assemblyConnections &&
//       !!assemblyConnections.find(
//         connection =>
//           connection.name === readConfObject(connectionConf, 'name'),
//       )
//     if (existingConnection) {
//       breakConnection(connectionConf)
//     } else {
//       session.makeConnection(connectionConf)
//     }
//   }

//   function breakConnection(connectionConf, deleting = false) {
//     const name = readConfObject(connectionConf, 'name')
//     const result = session.prepareToBreakConnection(connectionConf)
//     if (result) {
//       const [safelyBreakConnection, dereferenceTypeCount] = result
//       // always popup a warning if deleting or tracks are going to be removed
//       // from view
//       if (Object.keys(dereferenceTypeCount).length > 0 || deleting) {
//         setModalInfo({
//           connectionConf,
//           safelyBreakConnection,
//           dereferenceTypeCount,
//           name,
//           deleting,
//         })
//       } else {
//         safelyBreakConnection()
//       }
//     } else if (deleting) {
//       setModalInfo({ name, deleting, connectionConf })
//     }
//   }
const HierarchicalTrackSelector = observer(({ model, toolbarHeight = 0 }) => {
  const [assemblyIdx, setAssemblyIdx] = useState(0)
  const [modalInfo, setModalInfo] = useState()
  const [headerHeight, setHeaderHeight] = useState(0)
  const classes = useStyles()
  const session = getSession(model)

  const { assemblyNames } = model
  const assemblyName = assemblyNames[assemblyIdx]
  if (!assemblyName) {
    return null
  }
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
      <Example
        tree={nodes}
        model={model}
        offset={toolbarHeight + headerHeight}
      />
    </>
  )
})

export default HierarchicalTrackSelectorContainer
