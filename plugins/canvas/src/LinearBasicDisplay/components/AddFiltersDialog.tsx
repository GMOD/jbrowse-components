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
    activeFilters: () => string[]
    setJexlFilters: (arg?: string[]) => void
  }
  handleClose: () => void
}) {
  return (
    <JexlFilterDialog
      filters={model.activeFilters()}
      setFilters={arg => {
        model.setJexlFilters(arg)
      }}
      handleClose={handleClose}
      jexl={getEnv<{ pluginManager: PluginManager }>(model).pluginManager.jexl}
    />
  )
})

export default AddFiltersDialog
