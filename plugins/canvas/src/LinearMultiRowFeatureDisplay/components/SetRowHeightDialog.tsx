import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// The "Custom..." row-height entry, matching the one the MAF display offers so
// the two Row height menus read the same. Deliberately a local copy rather than
// a shared component: the variants display's dialog sets only a height (no row
// proportion), so a shared one would need a per-consumer opt-out.
const SetRowHeightDialog = observer(function (props: {
  model: {
    // Seed from the raw setting (0 = squeeze to fit), never the resolved
    // rowHeight getter, which in fit mode returns the computed fractional
    // height — submitting that would silently pin it.
    rowHeightSetting: number
    setRowHeight: (arg: number) => void
    // 0 is the fit sentinel this dialog advertises, so submitting it takes the
    // same route as the "Squeeze to fit view" radio rather than writing the
    // sentinel raw: fit height comes from the `height` slot, which setRowHeight
    // leaves at a stale earlier value, so the track jumped on submit.
    setFitToHeight: () => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [value, setValue] = useState<number | undefined>(model.rowHeightSetting)

  return (
    <SubmitDialog
      open
      title="Custom row height"
      onCancel={handleClose}
      submitDisabled={value === undefined}
      onSubmit={() => {
        if (value !== undefined) {
          if (value === 0) {
            model.setFitToHeight()
          } else {
            model.setRowHeight(value)
          }
          handleClose()
        }
      }}
    >
      <NumberTextField
        defaultValue={model.rowHeightSetting}
        helperText="Enter row height in px (0 = squeeze to fit view)"
        autoFocus
        onValueChange={setValue}
      />
    </SubmitDialog>
  )
})

export default SetRowHeightDialog
