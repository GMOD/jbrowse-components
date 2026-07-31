import { Suspense, lazy, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  getSession,
  isSessionModelWithConnectionEditing,
  isSessionModelWithConnections,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import MenuIcon from '@mui/icons-material/Menu'
import { observer } from 'mobx-react'

import {
  showAddConnectionWidget,
  showAddTrackWidget,
} from '../../showAddWidget.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// lazies
const FacetedDialog = lazy(
  () => import('../../../FacetedSelector/components/FacetedDialog.tsx'),
)

// lazy components
const DeleteConnectionDialog = lazy(
  () => import('../dialogs/DeleteConnectionDialog.tsx'),
)
const ManageConnectionsDialog = lazy(
  () => import('../dialogs/ManageConnectionsDialog.tsx'),
)

interface DialogDetails {
  name: string
  connectionConf: AnyConfigurationModel
}

const HamburgerMenu = observer(function HamburgerMenu({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const session = getSession(model)
  const [deleteDialogDetails, setDeleteDialogDetails] =
    useState<DialogDetails>()
  const [connectionManagerOpen, setConnectionManagerOpen] = useState(false)
  const [facetedOpen, setFacetedOpen] = useState(false)

  return (
    <>
      <CascadingMenuButton
        data-testid="track-selector-hamburger"
        tooltip="Track selector menu"
        menuItems={() => [
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
                    showAddTrackWidget(
                      session,
                      model.view.id,
                      model.trackContainerId,
                    )
                  },
                },
              ]
            : []),
          // only offer the Connections submenu when the session can edit
          // connections, otherwise it opens to an empty popup
          ...(isSessionModelWithConnectionEditing(session)
            ? [
                {
                  label: 'Connections...',
                  subMenu: [
                    {
                      label: 'Add connection...',
                      onClick: () => {
                        showAddConnectionWidget(session)
                      },
                    },
                    {
                      label: 'Delete connections...',
                      onClick: () => {
                        setConnectionManagerOpen(true)
                      },
                    },
                  ],
                },
              ]
            : []),
          {
            label: 'Sort...',
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
        {deleteDialogDetails && isSessionModelWithConnections(session) ? (
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
            onDelete={conf => {
              setDeleteDialogDetails({
                name: readConfObject(conf, 'name'),
                connectionConf: conf,
              })
            }}
            session={session}
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
