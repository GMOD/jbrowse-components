import React, { Suspense, lazy, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { Badge, IconButton, InputAdornment, TextField } from '@mui/material'
// icons
import ClearIcon from '@mui/icons-material/Clear'
import MenuIcon from '@mui/icons-material/Menu'
import NotificationIcon from '@mui/icons-material/Notifications'
import { Cable } from '@jbrowse/core/ui/Icons'

// other
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
  const [groupEl, setGroupEl] = useState<HTMLButtonElement>()
  const [menuEl, setMenuEl] = useState<HTMLButtonElement>()
  const [modalInfo, setModalInfo] = useState<ModalArgs>()
  const [deleteDlgDetails, setDeleteDlgDetails] = useState<DialogDetails>()
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
          const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
            view: model.view.id,
          })
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

        {model.group.length ? (
          <IconButton
            className={classes.menuIcon}
            onClick={event => setGroupEl(event.currentTarget)}
          >
            <Badge badgeContent={model.group.length} color="primary">
              <NotificationIcon />
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
        anchorEl={groupEl}
        open={Boolean(groupEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setGroupEl(undefined)
        }}
        onClose={() => setGroupEl(undefined)}
        menuItems={[
          { label: 'Clear', onClick: () => model.clearGroup() },
          {
            label: 'Create multi-wiggle track',
            onClick: () => {
              const tracks = model.group
              const trackIds = tracks.map(c => c.trackId)
              const subadapters = tracks
                .map(c => readConfObject(c, 'adapter'))
                .map((c, idx) => ({ ...c, source: trackIds[idx] }))
              const assemblyNames = Array.from(
                new Set(
                  tracks.map(c => readConfObject(c, 'assemblyNames')).flat(),
                ),
              )
              const now = +Date.now()
              const trackId = `multitrack-${now}-sessionTrack`
              getSession(model).addTrackConf({
                type: 'MultiQuantitativeTrack',
                trackId,
                name: 'MultiWig - ' + Date.now(),
                assemblyNames,
                adapter: {
                  type: 'MultiWiggleAdapter',
                  subadapters,
                },
              })
              model.view.showTrack(trackId)
            },
          },
        ]}
      />
      <Suspense fallback={<div />}>
        {modalInfo ? (
          <CloseConnectionDialog
            modalInfo={modalInfo}
            setModalInfo={setModalInfo}
          />
        ) : deleteDlgDetails ? (
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
            assemblyName={assemblyName}
          />
        ) : null}
      </Suspense>
    </div>
  )
}

export default observer(HierarchicalTrackSelectorHeader)
