import AddCustomPluginForm from '@jbrowse/core/ui/AddCustomPluginDialog'
import { getEnv, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { PluginStoreModel } from '../model.ts'

const AddCustomPluginDialog = observer(function AddCustomPluginDialog({
  onClose,
  model,
}: {
  onClose: () => void
  model: PluginStoreModel
}) {
  const session = getSession(model)
  const { jbrowse } = session
  const { pluginManager } = getEnv(model)

  return (
    <AddCustomPluginForm
      onClose={onClose}
      // Only the UMD form requires a name up front, so it is the only case that
      // can be checked before the plugin loads. ESM/CJS entries resolve their
      // name from the fetched module, so a same-name collision there only
      // surfaces later as PluginManager's silent skip-on-reload.
      onAdd={definition => {
        const name = 'name' in definition ? definition.name : undefined
        let added = true
        if (name !== undefined && pluginManager.hasPlugin(name)) {
          session.notify(
            `A plugin named "${name}" is already installed`,
            'error',
          )
          added = false
        } else {
          jbrowse.addPlugin(definition)
        }
        return added
      }}
    />
  )
})

export default AddCustomPluginDialog
