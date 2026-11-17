import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { Dialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import AssemblyAddForm from './AssemblyAddForm.tsx'
import AssemblyEditor from './AssemblyEditor.tsx'
import AssemblyTable from './AssemblyTable.tsx'

import type { AssemblyManagerSession } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util/types'

const AssemblyManager = observer(function AssemblyManager({
  session,
  onClose,
  initialFiles,
  editAssemblyName,
  onAddAssembly,
}: {
  session: AssemblyManagerSession
  onClose: () => void
  initialFiles?: FileLocation[]
  editAssemblyName?: string
  onAddAssembly?: () => void
}) {
  const [isFormOpen, setIsFormOpen] = useState(!!initialFiles)
  const [editingAssembly, setEditingAssembly] = useState<
    AnyConfigurationModel | undefined
  >(
    editAssemblyName
      ? session.assemblies.find(
          a => readConfObject(a, 'name') === editAssemblyName,
        )
      : undefined,
  )

  return (
    <Dialog
      open
      title="Assembly manager"
      onClose={() => {
        onClose()
      }}
    >
      {editingAssembly ? (
        <AssemblyEditor
          session={session}
          assembly={editingAssembly}
          onClose={() => {
            setEditingAssembly(undefined)
          }}
        />
      ) : isFormOpen ? (
        <AssemblyAddForm
          session={session}
          initialFiles={initialFiles}
          onClose={() => {
            if (initialFiles) {
              onClose()
            } else {
              setIsFormOpen(false)
            }
          }}
        />
      ) : (
        <AssemblyTable
          session={session}
          onClose={() => {
            onClose()
          }}
          onAddAssembly={
            onAddAssembly ??
            (() => {
              setIsFormOpen(true)
            })
          }
          onEditAssembly={arg => {
            setEditingAssembly(arg)
          }}
        />
      )}
    </Dialog>
  )
})

export default AssemblyManager
