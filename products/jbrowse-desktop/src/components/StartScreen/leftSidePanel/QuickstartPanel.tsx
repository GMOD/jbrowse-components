import { useState } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util'

import CollapsibleSection from './CollapsibleSection.tsx'
import LinkMenuRow from './LinkMenuRow.tsx'
import { useInnerDims } from '../availableGenomes/util.ts'
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

  // Additions from the RecentSessions panel invalidate this same SWR key
  // ('listQuickstarts') via a global mutate, so no polling is needed. Local
  // dialog close handlers call refetchQuickstarts() directly.
  const {
    data: quickstarts,
    error: listError,
    mutate: refetchQuickstarts,
  } = useFetch(
    'listQuickstarts',
    () => ipcRenderer.invoke('listQuickstarts') as Promise<string[]>,
  )

  return (
    <CollapsibleSection
      storageKey="startScreen-quickstartMinimized"
      title="Quickstart list"
    >
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
                <LinkMenuRow
                  key={name}
                  label={name}
                  onLinkClick={() => {
                    launch([name])
                  }}
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
                />
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
            refetchQuickstarts().catch((e: unknown) => {
              console.error(e)
            })
          }}
        />
      ) : null}

      {renameDialogOpen && quickstarts ? (
        <RenameQuickstartDialog
          quickstartNames={quickstarts}
          quickstartToRename={renameDialogOpen}
          onClose={() => {
            setRenameDialogOpen(undefined)
            refetchQuickstarts().catch((e: unknown) => {
              console.error(e)
            })
          }}
        />
      ) : null}
    </CollapsibleSection>
  )
}
