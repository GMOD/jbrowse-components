import { JexlFilterDialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const AddFiltersDialog = observer(function AddFiltersDialog({
  model,
  handleClose,
}: {
  model: {
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
    />
  )
})

export default AddFiltersDialog
