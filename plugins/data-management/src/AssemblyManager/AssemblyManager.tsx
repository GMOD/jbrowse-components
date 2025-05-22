import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { AssemblyAboutDialog } from '@jbrowse/product-core'
import { observer } from 'mobx-react'

import AssemblyAddForm from './AssemblyAddForm'
import AssemblyEditor from './AssemblyEditor'
import AssemblyTable from './AssemblyTable'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const AssemblyManager = observer(function ({
  session,
  onClose,
}: {
  session: AbstractSessionModel
  onClose: () => void
}) {
  const [isFormOpen, setFormOpen] = useState(false)
  const [editingAssembly, setEditingAssembly] =
    useState<AnyConfigurationModel>()
  const [assemblyInfo, setAssemblyInfo] = useState<AnyConfigurationModel>()

  return (
    <>
      <Dialog open title="Assembly manager" onClose={onClose}>
        {editingAssembly ? (
          <AssemblyEditor
            assembly={editingAssembly}
            onClose={() => {
              setEditingAssembly(undefined)
            }}
          />
        ) : isFormOpen ? (
          <AssemblyAddForm
            session={session}
            onClose={() => {
              setFormOpen(false)
            }}
          />
        ) : (
          <AssemblyTable
            session={session}
            onClose={() => {
              onClose()
            }}
            onAddAssembly={() => {
              setFormOpen(true)
            }}
            onEditAssembly={arg => {
              setEditingAssembly(arg)
            }}
            onGetAssemblyInfo={arg => {
              setAssemblyInfo(arg)
            }}
          />
        )}
      </Dialog>
      {assemblyInfo ? (
        <AssemblyAboutDialog
          handleClose={() => {
            setAssemblyInfo(undefined)
          }}
          config={assemblyInfo.sequence}
        />
      ) : null}
    </>
  )
})

export default AssemblyManager
