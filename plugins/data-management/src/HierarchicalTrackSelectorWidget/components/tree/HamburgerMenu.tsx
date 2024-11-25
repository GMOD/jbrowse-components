import React, { Suspense, lazy, useState } from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  getSession,
  isSessionModelWithConnectionEditing,
  isSessionModelWithConnections,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'

// icons
import MenuIcon from '@mui/icons-material/Menu'
import { observer } from 'mobx-react'

// locals
import type { HierarchicalTrackSelectorModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// lazies
const FacetedDialog = lazy(() => import('../faceted/FacetedDialog'))

// lazy components
const CloseConnectionDialog = lazy(
  () => import('../dialogs/CloseConnectionDialog'),
)
const DeleteConnectionDialog = lazy(
  () => import('../dialogs/DeleteConnectionDialog'),
)
const ManageConnectionsDialog = lazy(
  () => import('../dialogs/ManageConnectionsDialog'),
)
const ToggleConnectionsDialog = lazy(
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
  const [deleteDialogDetails, setDeleteDialogDetails] =
    useState<DialogDetails>()
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
      setDeleteDialogDetails({ name, connectionConf })
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
                      onClick: () => {
                        setConnectionToggleOpen(true)
                      },
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
                      onClick: () => {
                        setConnectionManagerOpen(true)
                      },
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
                onClick: () => {
                  model.setSortTrackNames(!model.activeSortTrackNames)
                },
              },
              {
                label: 'Sort categories by name',
                type: 'checkbox',
                checked: model.activeSortCategories,
                onClick: () => {
                  model.setSortCategories(!model.activeSortCategories)
                },
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
                      onClick: () => {
                        model.collapseSubCategories()
                      },
                    },
                  ]
                : []),
              {
                label: 'Collapse top-level categories',
                onClick: () => {
                  model.collapseTopLevelCategories()
                },
              },
              {
                label: 'Expand all categories',
                onClick: () => {
                  model.expandAllCategories()
                },
              },
            ],
          },
        ]}
      >
        <MenuIcon />
      </CascadingMenuButton>
      <Suspense fallback={null}>
        {modalInfo ? (
          <CloseConnectionDialog
            modalInfo={modalInfo}
            onClose={() => {
              setModalInfo(undefined)
            }}
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
            handleClose={() => {
              setConnectionManagerOpen(false)
            }}
            breakConnection={breakConnection}
            session={session}
          />
        ) : null}
        {connectionToggleOpen ? (
          <ToggleConnectionsDialog
            handleClose={() => {
              setConnectionToggleOpen(false)
            }}
            session={session}
            breakConnection={breakConnection}
          />
        ) : null}

        {facetedOpen ? (
          <FacetedDialog
            handleClose={() => {
              setFacetedOpen(false)
            }}
            model={model}
          />
        ) : null}
      </Suspense>
    </>
  )
})

export default HamburgerMenu
