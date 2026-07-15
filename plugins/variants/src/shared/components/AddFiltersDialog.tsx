import { JexlFilterDialog } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const AddFiltersDialog = observer(function AddFiltersDialog({
  model,
  handleClose,
}: {
  model: IAnyStateTreeNode & {
    jexlFilters?: string[]
    setJexlFilters: (arg?: string[]) => void
  }
  handleClose: () => void
}) {
  return (
    <JexlFilterDialog
      filters={model.jexlFilters}
      setFilters={arg => {
        model.setJexlFilters(arg.length > 0 ? arg : undefined)
      }}
      handleClose={handleClose}
      jexl={getEnv<{ pluginManager: PluginManager }>(model).pluginManager.jexl}
    />
  )
})

export default AddFiltersDialog
