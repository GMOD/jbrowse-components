import React, { Suspense, lazy, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { Badge, IconButton, InputAdornment, TextField } from '@mui/material'
// icons
import ClearIcon from '@mui/icons-material/Clear'
import MenuIcon from '@mui/icons-material/Menu'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { Cable } from '@jbrowse/core/ui/Icons'

// other
import JBrowseMenu, { MenuItem } from '@jbrowse/core/ui/Menu'
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
import { getEnv } from 'mobx-state-tree'

// locals
import { HierarchicalTrackSelectorModel } from '../model'

// lazy components
const CloseConnectionDialog = lazy(() => import('./CloseConnectionDialog'))
const DeleteConnectionDialog = lazy(() => import('./DeleteConnectionDialog'))
const ManageConnectionsDialog = lazy(() => import('./ManageConnectionsDialog'))
const ToggleConnectionsDialog = lazy(() => import('./ToggleConnectionsDialog'))

const useStyles = makeStyles()(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
  menuIcon: {
    marginRight: theme.spacing(1),
    marginBottom: 0,
  },
}))

interface ModalArgs {
  connectionConf: AnyConfigurationModel
  safelyBreakConnection: Function
  dereferenceTypeCount: { [key: string]: number }
  name: string
}

interface DialogDetails {
  name: string
  connectionConf: AnyConfigurationModel
}

function HierarchicalTrackSelectorHeader({
  model,
  setHeaderHeight,
  setAssemblyIdx,
  assemblyIdx,
}: {
  model: HierarchicalTrackSelectorModel
  setHeaderHeight: (n: number) => void
  setAssemblyIdx: (n: number) => void
  assemblyIdx: number
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const [connectionEl, setConnectionEl] = useState<HTMLButtonElement>()
  const [selectionEl, setSelectionEl] = useState<HTMLButtonElement>()
  const [menuEl, setMenuEl] = useState<HTMLButtonElement>()
  const [modalInfo, setModalInfo] = useState<ModalArgs>()
  const [deleteDlgDetails, setDeleteDlgDetails] = useState<DialogDetails>()
  const [connectionManagerOpen, setConnectionManagerOpen] = useState(false)
  const [connectionToggleOpen, setConnectionToggleOpen] = useState(false)
  const { assemblyNames } = model

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
      setDeleteDlgDetails({ name, connectionConf })
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
          session.showWidget(
            session.addWidget('AddConnectionWidget', 'addConnectionWidget'),
          )
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
          session.showWidget(
            session.addWidget('AddTrackWidget', 'addTrackWidget', {
              view: model.view.id,
            }),
          )
        }
      },
    },

    ...assemblyMenuItems,
  ]

  const items = getEnv(model).pluginManager.evaluateExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    [],
    { session },
  ) as MenuItem[]
  return (
    <div
      ref={ref => setHeaderHeight(ref?.getBoundingClientRect().height || 0)}
      data-testid="hierarchical_track_selector"
    >
      <div style={{ display: 'flex' }}>
        {isSessionWithAddTracks(session) && (
          <IconButton
            className={classes.menuIcon}
            onClick={event => setMenuEl(event.currentTarget)}
          >
            <MenuIcon />
          </IconButton>
        )}

        {session.makeConnection && (
          <IconButton
            className={classes.menuIcon}
            onClick={event => setConnectionEl(event.currentTarget)}
          >
            <Cable />
          </IconButton>
        )}

        {model.selection.length ? (
          <IconButton
            className={classes.menuIcon}
            onClick={event => setSelectionEl(event.currentTarget)}
          >
            <Badge badgeContent={model.selection.length} color="primary">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        ) : null}

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
        anchorEl={connectionEl}
        open={Boolean(connectionEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setConnectionEl(undefined)
        }}
        onClose={() => setConnectionEl(undefined)}
        menuItems={connectionMenuItems}
      />
      <JBrowseMenu
        anchorEl={menuEl}
        open={Boolean(menuEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setMenuEl(undefined)
        }}
        onClose={() => setMenuEl(undefined)}
        menuItems={menuItems}
      />
      <JBrowseMenu
        anchorEl={selectionEl}
        open={Boolean(selectionEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setSelectionEl(undefined)
        }}
        onClose={() => setSelectionEl(undefined)}
        menuItems={[
          { label: 'Clear', onClick: () => model.clearSelection() },
          ...items.map(item => ({
            ...item,
            ...('onClick' in item
              ? { onClick: () => item.onClick(model) }
              : {}),
          })),
        ]}
      />
      <Suspense fallback={<div />}>
        {modalInfo ? (
          <CloseConnectionDialog
            modalInfo={modalInfo}
            setModalInfo={setModalInfo}
          />
        ) : null}
        {deleteDlgDetails ? (
          <DeleteConnectionDialog
            handleClose={() => setDeleteDlgDetails(undefined)}
            deleteDialogDetails={deleteDlgDetails}
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
          />
        ) : null}
      </Suspense>
    </div>
  )
}

export default observer(HierarchicalTrackSelectorHeader)
