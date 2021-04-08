/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import {
  Checkbox,
  Fab,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'

// icons
import ClearIcon from '@material-ui/icons/Clear'
import AddIcon from '@material-ui/icons/Add'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'
import MenuIcon from '@material-ui/icons/Menu'
import MoreIcon from '@material-ui/icons/MoreHoriz'

// other
import AutoSizer from 'react-virtualized-auto-sizer'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import { getSession } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { VariableSizeTree } from 'react-vtree'

import CloseConnectionDialog from './CloseConnectionDialog'
import DeleteConnectionDialog from './DeleteConnectionDialog'
import ManageConnectionsDialog from './ManageConnectionsDialog'

const rowHeight = 22
const accordionHeight = 40
const useStyles = makeStyles(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
  menuIcon: {
    margin: theme.spacing(2),
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing(4),
    right: theme.spacing(4),
  },
  compactCheckbox: {
    padding: 0,
  },

  checkboxLabel: {
    '&:hover': {
      backgroundColor: '#ddd',
    },
  },

  // this accordionBase element's small padding is used to give a margin to
  // accordionColor it a "margin" because the virtualized elements can't really
  // use margin in a conventional way (it doesn't affect layout)
  accordionBase: {
    cursor: 'pointer',
    padding: 3,
    display: 'flex',
  },

  // accordionColor set's display:flex so that the child accordionText use
  // vertically centered text
  accordionColor: {
    background: theme.palette.tertiary?.main,
    color: theme.palette.tertiary?.contrastText,
    width: '100%',
    display: 'flex',
    paddingLeft: 5,
  },

  // margin:auto 0 to center text vertically
  accordionText: {
    margin: 'auto 0',
  },
}))

// adapted from react-vtree docs
function makeTreeWalker({ nodes, onChange, onMoreInfo }) {
  return function* treeWalker(refresh) {
    const stack = []

    stack.push({
      nestingLevel: 0,
      node: nodes,
    })

    while (stack.length !== 0) {
      const { node, nestingLevel } = stack.pop()
      const { id, name, conf, selected } = node
      const isOpened = yield refresh
        ? {
            id,
            isLeaf: !!conf,
            isOpenByDefault: true,
            name,
            node,
            checked: !!selected,
            nestingLevel,
            onChange,
            onMoreInfo,
            conf,
            defaultHeight: conf ? rowHeight : accordionHeight,
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

// An individual node in the track selector. Note: manually sets cursor:
// pointer improves usability for what can be clicked
const Node = props => {
  const { data, isOpen, style, toggle } = props
  const {
    isLeaf,
    nestingLevel,
    checked,
    id,
    name,
    onChange,
    conf,
    onMoreInfo,
  } = data
  const classes = useStyles()
  const marginLeft = nestingLevel * 10 + (isLeaf ? 10 : 0)

  return (
    <div
      className={!isLeaf ? classes.accordionBase : undefined}
      role="presentation"
      onClick={toggle}
      style={{
        ...style,
        marginLeft,
        whiteSpace: 'nowrap',

        // interesting note: width:100% here dynamically makes window wider
        // while scrolling for long track labels, which means we don't need
        // long track label wrapping necessarily
        width: '100%',
      }}
    >
      <div className={!isLeaf ? classes.accordionColor : undefined}>
        {!isLeaf ? (
          <div className={classes.accordionText}>
            <Typography style={{}}>
              {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
              {name}
            </Typography>
          </div>
        ) : (
          <>
            <FormControlLabel
              control={
                <Checkbox
                  className={classes.compactCheckbox}
                  checked={checked}
                  onChange={() => onChange(id)}
                  color="primary"
                  inputProps={{
                    'data-testid': `htsTrackEntry-${id}`,
                  }}
                />
              }
              label={
                /* it is helpful for styling to keep this inside the label */
                <>
                  <span className={classes.checkboxLabel}>{name}</span>
                  <IconButton
                    onClick={event => {
                      onMoreInfo({ target: event.currentTarget, id, conf })
                    }}
                    color="secondary"
                    data-testid={`htsTrackEntryMenu-${id}`}
                  >
                    <MoreIcon />
                  </IconButton>
                </>
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

// this is the main tree component for the hierarchical track selector in note:
// in jbrowse-web the toolbar is position="sticky" which means the autosizer
// includes the height of the toolbar, so we subtract the given offsets
const HierarchicalTree = observer(({ height, tree, model }) => {
  const [info, setMoreInfo] = useState()
  const session = getSession(model)
  const treeWalker = makeTreeWalker({
    nodes: {
      name: 'Tracks',
      id: 'Tracks',
      children: tree,
    },
    onChange: trackId => model.view.toggleTrack(trackId),
    onMoreInfo: setMoreInfo,
  })

  const conf = info?.conf
  const menuItems =
    conf && session.getTrackActionMenuItems
      ? session.getTrackActionMenuItems(conf)
      : []
  return (
    <>
      <VariableSizeTree treeWalker={treeWalker} height={height} width="100%">
        {Node}
      </VariableSizeTree>
      <JBrowseMenu
        anchorEl={info?.target}
        menuItems={menuItems}
        onMenuItemClick={(_event, callback) => {
          callback()
          setMoreInfo(undefined)
        }}
        open={Boolean(info)}
        onClose={() => setMoreInfo(undefined)}
      />
    </>
  )
})

// Don't use autosizer in jest and instead hardcode a height, otherwise fails
// jest tests
const AutoSizedHierarchicalTree = ({ tree, model, offset }) => {
  return typeof jest === 'undefined' ? (
    <AutoSizer disableWidth>
      {({ height }) => {
        return (
          <HierarchicalTree
            height={height - offset}
            model={model}
            tree={tree}
          />
        )
      }}
    </AutoSizer>
  ) : (
    <HierarchicalTree height={9000} model={model} tree={tree} />
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
    const [deleteDialogDetails, setDeleteDialogDetails] = useState()
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

    function breakConnection(connectionConf, deletingConnection) {
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
      if (deletingConnection) {
        setDeleteDialogDetails({ name, connectionConf })
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
        data-testid="hierarchical_track_selector"
      >
        <div style={{ display: 'flex' }}>
          {
            /*
             * if there are no connections and this is not a multi-assembly
             * drop down menu here may be unneeded and cause more confusion than
             * help,  so conditionally renders
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

        {deleteDialogDetails ? (
          <DeleteConnectionDialog
            handleClose={() => {
              setDeleteDialogDetails(undefined)
            }}
            deleteDialogDetails={deleteDialogDetails}
            session={session}
          />
        ) : null}
        {connectionManagerOpen ? (
          <ManageConnectionsDialog
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
      <AutoSizedHierarchicalTree
        tree={nodes}
        model={model}
        offset={toolbarHeight + headerHeight}
      />
    </>
  )
})

export default HierarchicalTrackSelectorContainer
