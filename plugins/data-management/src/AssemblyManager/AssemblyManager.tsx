import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import AssemblyAddForm from './AssemblyAddForm'
import AssemblyEditor from './AssemblyEditor'
import AssemblyTable from './AssemblyTable'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const AssemblyManager = observer(function ({
  rootModel,
  onClose,
}: {
  rootModel: any
  onClose: () => void
}) {
  const [isFormOpen, setFormOpen] = useState(false)
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
          assembly={editingAssembly}
          onClose={() => {
            setEditingAssembly(undefined)
          }}
        />
      ) : isFormOpen ? (
        <AssemblyAddForm
          rootModel={rootModel}
          onClose={() => setFormOpen(false)}
        />
      ) : (
        <AssemblyTable
          rootModel={rootModel}
          onClose={onClose}
          setAddAssemblyFormOpen={setFormOpen}
          setAssemblyBeingEdited={setEditingAssembly}
        />
      )}
    </Dialog>
  )
})

export default AssemblyManager
