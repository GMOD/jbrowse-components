import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import AssemblyAddForm from './AssemblyAddForm.tsx'
import AssemblyEditor from './AssemblyEditor.tsx'
import AssemblyTable from './AssemblyTable.tsx'

import type { AssemblyManagerSession } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const AssemblyManager = observer(function AssemblyManager({
  session,
  onClose,
}: {
  session: AssemblyManagerSession
  onClose: () => void
}) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAssembly, setEditingAssembly] =
    useState<AnyConfigurationModel>()

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
          onClose={() => {
            setIsFormOpen(false)
          }}
        />
      ) : (
        <AssemblyTable
          session={session}
          onClose={() => {
            onClose()
          }}
          onAddAssembly={() => {
            setIsFormOpen(true)
          }}
          onEditAssembly={arg => {
            setEditingAssembly(arg)
          }}
        />
      )}
    </Dialog>
  )
})

export default AssemblyManager
