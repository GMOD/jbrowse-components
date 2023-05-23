import React, { Suspense, lazy, useState } from 'react'
import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import {
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  isSessionModelWithConnections,
} from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

// icons
import MenuIcon from '@mui/icons-material/Menu'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'

// lazy components
const CloseConnectionDlg = lazy(
  () => import('../dialogs/CloseConnectionDialog'),
)
const DeleteConnectionDlg = lazy(
  () => import('../dialogs/DeleteConnectionDialog'),
)
const ManageConnectionsDlg = lazy(
  () => import('../dialogs/ManageConnectionsDialog'),
)
const ToggleConnectionsDlg = lazy(
  () => import('../dialogs/ToggleConnectionsDialog'),
)

const useStyles = makeStyles()(theme => ({
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

export default observer(function HamburgerMenu({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const session = getSession(model)
  const [menuEl, setMenuEl] = useState<HTMLButtonElement>()
  const [modalInfo, setModalInfo] = useState<ModalArgs>()
  const [deleteDlgDetails, setDeleteDlgDetails] = useState<DialogDetails>()
  const [connectionToggleOpen, setConnectionToggleOpen] = useState(false)
  const [connectionManagerOpen, setConnectionManagerOpen] = useState(false)
  const { classes } = useStyles()

  function breakConnection(
    connectionConf: AnyConfigurationModel,
    deletingConnection?: boolean,
  ) {
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
      label: 'Add connection...',
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

  const trackMenuItems = [
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
  ]

  return (
    <>
      <IconButton
        className={classes.menuIcon}
        onClick={event => setMenuEl(event.currentTarget)}
      >
        <MenuIcon />
      </IconButton>

      <JBrowseMenu
        anchorEl={menuEl}
        open={Boolean(menuEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setMenuEl(undefined)
        }}
        onClose={() => setMenuEl(undefined)}
        menuItems={[
          ...(isSessionWithAddTracks(session) ? trackMenuItems : []),
          ...(session.makeConnection ? connectionMenuItems : []),
        ]}
      />
      <Suspense fallback={<div />}>
        {modalInfo ? (
          <CloseConnectionDlg
            modalInfo={modalInfo}
            setModalInfo={setModalInfo}
          />
        ) : null}
        {deleteDlgDetails ? (
          <DeleteConnectionDlg
            handleClose={() => setDeleteDlgDetails(undefined)}
            deleteDialogDetails={deleteDlgDetails}
            session={session}
          />
        ) : null}
        {connectionManagerOpen ? (
          <ManageConnectionsDlg
            handleClose={() => setConnectionManagerOpen(false)}
            breakConnection={breakConnection}
            session={session}
          />
        ) : null}
        {connectionToggleOpen ? (
          <ToggleConnectionsDlg
            handleClose={() => setConnectionToggleOpen(false)}
            session={session}
            breakConnection={breakConnection}
          />
        ) : null}
      </Suspense>
    </>
  )
})
