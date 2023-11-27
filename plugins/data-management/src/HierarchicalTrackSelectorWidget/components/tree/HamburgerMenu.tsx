import React, { Suspense, lazy, useState } from 'react'
import { observer } from 'mobx-react'
import {
  getSession,
  isSessionModelWithConnectionEditing,
  isSessionModelWithConnections,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import MenuIcon from '@mui/icons-material/Menu'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'

// lazies
const FacetedDialog = lazy(() => import('../faceted/FacetedDialog'))

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

interface ModalArgs {
  connectionConf: AnyConfigurationModel
  safelyBreakConnection: () => void
  dereferenceTypeCount: Record<string, number>
  name: string
}

interface DialogDetails {
  name: string
  connectionConf: AnyConfigurationModel
}

const HamburgerMenu = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const session = getSession(model)
  const [modalInfo, setModalInfo] = useState<ModalArgs>()
  const [deleteDlgDetails, setDeleteDlgDetails] = useState<DialogDetails>()
  const [connectionToggleOpen, setConnectionToggleOpen] = useState(false)
  const [connectionManagerOpen, setConnectionManagerOpen] = useState(false)
  const [facetedOpen, setFacetedOpen] = useState(false)

  function breakConnection(
    connectionConf: AnyConfigurationModel,
    deletingConnection?: boolean,
  ) {
    const name = readConfObject(connectionConf, 'name')
    const result = session.prepareToBreakConnection?.(connectionConf)
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

  return (
    <>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Open faceted track selector',
            onClick: () => {
              setFacetedOpen(true)
            },
          },
          ...(isSessionWithAddTracks(session)
            ? [
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
            : []),
          {
            label: 'Connections...',
            subMenu: [
              ...(isSessionModelWithConnections(session)
                ? [
                    {
                      label: 'Turn on/off connections...',
                      onClick: () => setConnectionToggleOpen(true),
                    },
                  ]
                : []),
              ...(isSessionModelWithConnectionEditing(session)
                ? [
                    {
                      label: 'Add connection...',
                      onClick: () => {
                        if (isSessionModelWithWidgets(session)) {
                          session.showWidget(
                            session.addWidget(
                              'AddConnectionWidget',
                              'addConnectionWidget',
                            ),
                          )
                        }
                      },
                    },
                    {
                      label: 'Delete connections...',
                      onClick: () => setConnectionManagerOpen(true),
                    },
                  ]
                : []),
            ],
          },
          {
            label: 'Sort...',
            type: 'subMenu',
            subMenu: [
              {
                label: 'Sort tracks by name',
                type: 'checkbox',
                checked: model.activeSortTrackNames,
                onClick: () =>
                  model.setSortTrackNames(!model.activeSortTrackNames),
              },
              {
                label: 'Sort categories by name',
                type: 'checkbox',
                checked: model.activeSortCategories,
                onClick: () =>
                  model.setSortCategories(!model.activeSortCategories),
              },
            ],
          },
          {
            label: 'Collapse...',
            type: 'subMenu',
            subMenu: [
              ...(model.hasAnySubcategories
                ? [
                    {
                      label: 'Collapse subcategories',
                      onClick: () => model.collapseSubCategories(),
                    },
                  ]
                : []),
              {
                label: 'Collapse top-level categories',
                onClick: () => model.collapseTopLevelCategories(),
              },
              {
                label: 'Expand all categories',
                onClick: () => model.expandAllCategories(),
              },
            ],
          },
        ]}
      >
        <MenuIcon />
      </CascadingMenuButton>
      <Suspense fallback={<React.Fragment />}>
        {modalInfo ? (
          <CloseConnectionDlg
            modalInfo={modalInfo}
            onClose={() => setModalInfo(undefined)}
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

        {facetedOpen ? (
          <FacetedDialog
            handleClose={() => setFacetedOpen(false)}
            model={model}
          />
        ) : null}
      </Suspense>
    </>
  )
})

export default HamburgerMenu
