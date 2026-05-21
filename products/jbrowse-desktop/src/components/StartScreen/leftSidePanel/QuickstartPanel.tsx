import { useState } from 'react'

import {
  CascadingMenuButton,
  ErrorMessage,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util'
import MoreIcon from '@mui/icons-material/MoreHoriz'
import { Link } from '@mui/material'

import { useInnerDims } from '../availableGenomes/util.ts'
import CollapsibleSection from './CollapsibleSection.tsx'
import DeleteQuickstartDialog from '../dialogs/DeleteQuickstartDialog.tsx'
import RenameQuickstartDialog from '../dialogs/RenameQuickstartDialog.tsx'

const { ipcRenderer } = window.require('electron')

export default function QuickstartPanel({
  launch,
}: {
  launch: (arg0: string[]) => void
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string>()
  const [renameDialogOpen, setRenameDialogOpen] = useState<string>()
  const { height: innerHeight } = useInnerDims()

  const {
    data: quickstarts,
    error: listError,
    mutate: refetchQuickstarts,
  } = useFetch(
    'listQuickstarts',
    () => ipcRenderer.invoke('listQuickstarts') as Promise<string[]>,
    // Poll so additions from the RecentSessions panel (addToQuickstartList
    // writes via IPC directly without notifying this component) are reflected
    // promptly. Dialog close handlers call mutate() for immediate updates.
    { refreshInterval: 500 },
  )

  return (
    <CollapsibleSection storageKey="startScreen-quickstartMinimized" title="Quickstart list">
      {listError && !quickstarts ? <ErrorMessage error={listError} /> : null}

      {quickstarts === undefined ? (
        <LoadingEllipses />
      ) : quickstarts.length === 0 ? (
        <div>No quickstarts available</div>
      ) : (
        <div style={{ maxHeight: innerHeight / 4, overflow: 'auto' }}>
          <table>
            <tbody>
              {quickstarts.map(name => (
                <tr key={name}>
                  <td>
                    <Link
                      href="#"
                      onClick={e => {
                        e.preventDefault()
                        launch([name])
                      }}
                    >
                      {name}
                    </Link>{' '}
                    <CascadingMenuButton
                      style={{ padding: 0 }}
                      menuItems={[
                        {
                          label: 'Launch',
                          onClick: () => {
                            launch([name])
                          },
                        },
                        {
                          label: 'Delete',
                          onClick: () => {
                            setDeleteDialogOpen(name)
                          },
                        },
                        {
                          label: 'Rename',
                          onClick: () => {
                            setRenameDialogOpen(name)
                          },
                        },
                      ]}
                    >
                      <MoreIcon />
                    </CascadingMenuButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteDialogOpen ? (
        <DeleteQuickstartDialog
          quickstartToDelete={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(undefined)
            refetchQuickstarts().catch((e: unknown) => { console.error(e) })
          }}
        />
      ) : null}

      {renameDialogOpen && quickstarts ? (
        <RenameQuickstartDialog
          quickstartNames={quickstarts}
          quickstartToRename={renameDialogOpen}
          onClose={() => {
            setRenameDialogOpen(undefined)
            refetchQuickstarts().catch((e: unknown) => { console.error(e) })
          }}
        />
      ) : null}
    </CollapsibleSection>
  )
}
