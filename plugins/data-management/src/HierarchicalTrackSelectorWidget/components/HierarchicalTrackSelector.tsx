/* eslint-disable react/prop-types */
import React, {
  Suspense,
  lazy,
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
} from 'react'
import {
  Checkbox,
  Fab,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
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
import { Cable } from '@jbrowse/core/ui/Icons'

// other
import AutoSizer from 'react-virtualized-auto-sizer'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import {
  getSession,
  isSessionModelWithWidgets,
  isSessionModelWithConnections,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { VariableSizeTree } from 'react-vtree'

// locals
import { TreeNode, HierarchicalTrackSelectorModel } from '../model'

// lazy components
const CloseConnectionDialog = lazy(() => import('./CloseConnectionDialog'))
const DeleteConnectionDialog = lazy(() => import('./DeleteConnectionDialog'))
const ManageConnectionsDialog = lazy(() => import('./ManageConnectionsDialog'))
const ToggleConnectionsDialog = lazy(() => import('./ToggleConnectionsDialog'))

const useStyles = makeStyles(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
  menuIcon: {
    marginRight: theme.spacing(1),
    marginBottom: 0,
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing(6),
    right: theme.spacing(6),
  },
  compactCheckbox: {
    padding: 0,
  },

  checkboxLabel: {
    marginRight: 0,
    '&:hover': {
      backgroundColor: '#eee',
    },
  },

  // this accordionBase element's small padding is used to give a margin to
  // accordionColor it a "margin" because the virtualized elements can't really
  // use margin in a conventional way (it doesn't affect layout)
  accordionBase: {
    display: 'flex',
  },

  accordionCard: {
    padding: 3,
    cursor: 'pointer',
    display: 'flex',
  },

  nestingLevelMarker: {
    position: 'absolute',
    borderLeft: '1.5px solid #555',
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

interface MoreInfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

// An individual node in the track selector. Note: manually sets cursor:
// pointer improves usability for what can be clicked
function Node(props: {
  data: {
    isLeaf: boolean
    nestingLevel: number
    checked: boolean
    id: string
    name: string
    onChange: Function
    toggleCollapse: (arg: string) => void
    conf: AnyConfigurationModel
    onMoreInfo: (arg: MoreInfoArgs) => void
    drawerPosition: unknown
  }
  isOpen: boolean
  style?: any
  setOpen: (arg: boolean) => void
}) {
  const { data, isOpen, style, setOpen } = props
  const {
    isLeaf,
    nestingLevel,
    checked,
    id,
    name,
    onChange,
    toggleCollapse,
    conf,
    onMoreInfo,
    drawerPosition,
  } = data

  const classes = useStyles()
  const width = 10
  const marginLeft = nestingLevel * width + (isLeaf ? width : 0)
  const unsupported =
    name?.endsWith('(Unsupported)') || name?.endsWith('(Unknown)')
  const description = (conf && readConfObject(conf, ['description'])) || ''

  return (
    <div style={style} className={!isLeaf ? classes.accordionBase : undefined}>
      {new Array(nestingLevel).fill(0).map((_, idx) => (
        <div
          key={`mark-${idx}`}
          style={{ left: idx * width + 4, height: style.height }}
          className={classes.nestingLevelMarker}
        />
      ))}
      <div
        className={!isLeaf ? classes.accordionCard : undefined}
        onClick={() => {
          toggleCollapse(id)
          setOpen(!isOpen)
        }}
        style={{
          marginLeft,
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        <div className={!isLeaf ? classes.accordionColor : undefined}>
          {!isLeaf ? (
            <div className={classes.accordionText}>
              <Typography>
                {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
                {name}
              </Typography>
            </div>
          ) : (
            <>
              <Tooltip
                title={description}
                placement={drawerPosition === 'left' ? 'right' : 'left'}
              >
                <FormControlLabel
                  className={classes.checkboxLabel}
                  control={
                    <Checkbox
                      className={classes.compactCheckbox}
                      checked={checked}
                      onChange={() => onChange(id)}
                      color="primary"
                      disabled={unsupported}
                      inputProps={{
                        // @ts-ignore
                        'data-testid': `htsTrackEntry-${id}`,
                      }}
                    />
                  }
                  label={name}
                />
              </Tooltip>
              <IconButton
                onClick={e => onMoreInfo({ target: e.currentTarget, id, conf })}
                color="secondary"
                data-testid={`htsTrackEntryMenu-${id}`}
              >
                <MoreIcon />
              </IconButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function getNodeData(
  node: TreeNode,
  nestingLevel: number,
  extra: Record<string, unknown>,
) {
  const isLeaf = !!node.conf
  return {
    data: {
      defaultHeight: isLeaf ? 22 : 40,
      isLeaf,
      isOpenByDefault: true,
      nestingLevel,
      ...node,
      ...extra,
    },
    nestingLevel,
    node,
  }
}

type NodeData = ReturnType<typeof getNodeData>

// this is the main tree component for the hierarchical track selector in note:
// in jbrowse-web the toolbar is position="sticky" which means the autosizer
// includes the height of the toolbar, so we subtract the given offsets
const HierarchicalTree = observer(
  ({
    height,
    tree,
    model,
  }: {
    height: number
    tree: TreeNode
    model: HierarchicalTrackSelectorModel
  }) => {
    const { filterText, view } = model
    const treeRef = useRef<NodeData>(null)
    const [info, setMoreInfo] = useState<MoreInfoArgs>()
    const session = getSession(model)
    const { drawerPosition } = session

    const extra = useMemo(
      () => ({
        onChange: (trackId: string) => view.toggleTrack(trackId),
        toggleCollapse: (pathName: string) => model.toggleCategory(pathName),
        onMoreInfo: setMoreInfo,
        drawerPosition,
      }),
      [view, model, drawerPosition],
    )
    const treeWalker = useCallback(
      function* treeWalker() {
        for (let i = 0; i < tree.children.length; i++) {
          const r = tree.children[i]
          yield getNodeData(r, 0, extra)
        }

        while (true) {
          // @ts-ignore
          const parentMeta = yield

          for (let i = 0; i < parentMeta.node.children.length; i++) {
            const curr = parentMeta.node.children[i]
            yield getNodeData(curr, parentMeta.nestingLevel + 1, extra)
          }
        }
      },
      [tree, extra],
    )

    const conf = info?.conf
    const menuItems = (conf && session.getTrackActionMenuItems?.(conf)) || []

    useEffect(() => {
      // @ts-ignore
      treeRef.current.recomputeTree({
        refreshNodes: true,
        useDefaultHeight: true,
      })
    }, [tree, filterText])
    return (
      <>
        {/* @ts-ignore */}
        <VariableSizeTree ref={treeRef} treeWalker={treeWalker} height={height}>
          {/* @ts-ignore */}
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
  },
)

// Don't use autosizer in jest and instead hardcode a height, otherwise fails
// jest tests
const AutoSizedHierarchicalTree = ({
  tree,
  model,
  offset,
}: {
  tree: any
  model: HierarchicalTrackSelectorModel
  offset: number
}) => {
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

const Wrapper = ({
  overrideDimensions,
  children,
}: {
  overrideDimensions?: { width: number; height: number }
  children: React.ReactNode
}) => {
  console.log(overrideDimensions)
  return overrideDimensions ? (
    <div style={{ ...overrideDimensions }}>{children}</div>
  ) : (
    <>{children}</>
  )
}
const HierarchicalTrackSelectorContainer = observer(
  ({
    model,
    toolbarHeight,
    overrideDimensions,
  }: {
    model: HierarchicalTrackSelectorModel
    toolbarHeight: number
    overrideDimensions?: { width: number; height: number }
  }) => {
    const classes = useStyles()
    const session = getSession(model)
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)

    function handleFabClose() {
      setAnchorEl(null)
    }
    const hasConnections = isSessionModelWithConnections(session)
    const hasAddTrack = isSessionWithAddTracks(session)
    return (
      <Wrapper overrideDimensions={overrideDimensions}>
        <HierarchicalTrackSelector
          model={model}
          toolbarHeight={toolbarHeight}
        />
        {hasAddTrack || hasConnections ? (
          <>
            <Fab
              color="secondary"
              className={classes.fab}
              onClick={event => setAnchorEl(event.currentTarget)}
            >
              <AddIcon />
            </Fab>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              {hasConnections ? (
                <MenuItem
                  onClick={() => {
                    handleFabClose()
                    if (isSessionModelWithWidgets(session)) {
                      session.showWidget(
                        session.addWidget(
                          'AddConnectionWidget',
                          'addConnectionWidget',
                        ),
                      )
                    }
                  }}
                >
                  Add connection
                </MenuItem>
              ) : null}
              {hasAddTrack ? (
                <MenuItem
                  onClick={() => {
                    handleFabClose()
                    if (isSessionModelWithWidgets(session)) {
                      session.showWidget(
                        session.addWidget('AddTrackWidget', 'addTrackWidget', {
                          view: model.view.id,
                        }),
                      )
                    }
                  }}
                >
                  Add track
                </MenuItem>
              ) : null}
            </Menu>
          </>
        ) : null}
      </Wrapper>
    )
  },
)

const HierarchicalTrackSelectorHeader = observer(
  ({
    model,
    setHeaderHeight,
    setAssemblyIdx,
    assemblyIdx,
  }: {
    model: HierarchicalTrackSelectorModel
    setHeaderHeight: (n: number) => void
    setAssemblyIdx: (n: number) => void
    assemblyIdx: number
  }) => {
    const classes = useStyles()
    const session = getSession(model)
    const [connectionAnchorEl, setConnectionAnchorEl] =
      useState<HTMLButtonElement>()
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLButtonElement>()
    const [modalInfo, setModalInfo] = useState<{
      connectionConf: AnyConfigurationModel
      safelyBreakConnection: Function
      dereferenceTypeCount: { [key: string]: number }
      name: string
    }>()
    const [deleteDialogDetails, setDeleteDialogDetails] = useState<{
      name: string
      connectionConf: AnyConfigurationModel
    }>()
    const [connectionManagerOpen, setConnectionManagerOpen] = useState(false)
    const [connectionToggleOpen, setConnectionToggleOpen] = useState(false)
    const { assemblyNames } = model
    const assemblyName = assemblyNames[assemblyIdx]

    function breakConnection(
      connectionConf: AnyConfigurationModel,
      deletingConnection?: boolean,
    ) {
      const name = readConfObject(connectionConf, 'name')

      // @ts-ignore
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

    const connectionMenuItems = [
      {
        label: 'Turn on/off connections...',
        onClick: () => setConnectionToggleOpen(true),
      },
    ]

    if (isSessionModelWithConnections(session)) {
      connectionMenuItems.unshift({
        label: 'Add connection',
        onClick: () => {
          if (isSessionModelWithWidgets(session)) {
            const widget = session.addWidget(
              'AddConnectionWidget',
              'addConnectionWidget',
            )
            session.showWidget(widget)
          }
        },
      })

      connectionMenuItems.push({
        label: 'Delete connections...',
        onClick: () => setConnectionManagerOpen(true),
      })
    }

    const assemblyMenuItems =
      assemblyNames.length > 1
        ? [
            {
              label: 'Select assembly...',
              subMenu: assemblyNames.map((name, idx) => ({
                label: name,
                onClick: () => setAssemblyIdx(idx),
              })),
            },
          ]
        : []

    const menuItems = [
      {
        label: 'Add track...',
        onClick: () => {
          if (isSessionModelWithWidgets(session)) {
            const widget = session.addWidget(
              'AddTrackWidget',
              'addTrackWidget',
              {
                view: model.view.id,
              },
            )
            session.showWidget(widget)
          }
        },
      },

      ...assemblyMenuItems,
    ]

    return (
      <div
        ref={ref => setHeaderHeight(ref?.getBoundingClientRect().height || 0)}
        data-testid="hierarchical_track_selector"
      >
        <div style={{ display: 'flex' }}>
          {isSessionWithAddTracks(session) && (
            <IconButton
              className={classes.menuIcon}
              onClick={event => setMenuAnchorEl(event.currentTarget)}
            >
              <MenuIcon />
            </IconButton>
          )}

          {session.makeConnection && (
            <IconButton
              className={classes.menuIcon}
              onClick={event => setConnectionAnchorEl(event.currentTarget)}
            >
              <Cable />
            </IconButton>
          )}

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
          anchorEl={connectionAnchorEl}
          open={Boolean(connectionAnchorEl)}
          onMenuItemClick={(_, callback) => {
            callback()
            setConnectionAnchorEl(undefined)
          }}
          onClose={() => setConnectionAnchorEl(undefined)}
          menuItems={connectionMenuItems}
        />
        <JBrowseMenu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onMenuItemClick={(_, callback) => {
            callback()
            setMenuAnchorEl(undefined)
          }}
          onClose={() => setMenuAnchorEl(undefined)}
          menuItems={menuItems}
        />
        <Suspense fallback={<div />}>
          {modalInfo ? (
            <CloseConnectionDialog
              modalInfo={modalInfo}
              setModalInfo={setModalInfo}
            />
          ) : deleteDialogDetails ? (
            <DeleteConnectionDialog
              handleClose={() => setDeleteDialogDetails(undefined)}
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
          {connectionToggleOpen ? (
            <ToggleConnectionsDialog
              handleClose={() => setConnectionToggleOpen(false)}
              session={session}
              breakConnection={breakConnection}
              assemblyName={assemblyName}
            />
          ) : null}
        </Suspense>
      </div>
    )
  },
)
const HierarchicalTrackSelector = observer(
  ({
    model,
    toolbarHeight = 0,
  }: {
    model: HierarchicalTrackSelectorModel
    toolbarHeight?: number
  }) => {
    const [assemblyIdx, setAssemblyIdx] = useState(0)
    const [headerHeight, setHeaderHeight] = useState(0)

    const { assemblyNames } = model
    const assemblyName = assemblyNames[assemblyIdx]
    return assemblyName ? (
      <>
        <HierarchicalTrackSelectorHeader
          model={model}
          setHeaderHeight={setHeaderHeight}
          setAssemblyIdx={setAssemblyIdx}
          assemblyIdx={assemblyIdx}
        />
        <AutoSizedHierarchicalTree
          tree={model.hierarchy(assemblyName)}
          model={model}
          offset={toolbarHeight + headerHeight}
        />
      </>
    ) : null
  },
)

export default HierarchicalTrackSelectorContainer
