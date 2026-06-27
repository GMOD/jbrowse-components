import { JexlFilterDialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const AddFiltersDialog = observer(function AddFiltersDialog({
  model,
  handleClose,
}: {
  model: {
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
    />
  )
})

export default AddFiltersDialog
