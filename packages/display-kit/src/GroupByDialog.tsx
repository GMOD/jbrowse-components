import { useState } from 'react'

import LabeledCheckbox from '@jbrowse/core/ui/LabeledCheckbox'
import SubmitDialog from '@jbrowse/core/ui/SubmitDialog'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { Plot } from '@jbrowse/core/configuration'
import type React from 'react'

/** What the Group by dialog writes through. */
export interface GroupByPlotHost {
  applyGroupBy: (field: string | undefined, colorByGroup: boolean) => void
  groupByPlot: (field: string | undefined, colorByGroup: boolean) => Plot
  openPlotDialog: (seed?: Plot) => void
}

/**
 * The Group by dialog every display with a field-picked grouping shares:
 * `children` is the display's field input and its caption, `field` what it
 * names. The color box follows `colorsByDefault` until it is clicked, then
 * keeps the click. Apply waits for a field, for `pending` to settle and while
 * `blocks`; Edit plot... opens the choice unapplied in the plot editor.
 */
const GroupByDialog = observer(function GroupByDialog({
  model,
  handleClose,
  title,
  blurb,
  colorLabel,
  field,
  colorsByDefault,
  pending = false,
  blocks = false,
  children,
}: {
  model: GroupByPlotHost
  handleClose: () => void
  title: string
  blurb: string
  colorLabel: string
  field: string | undefined
  colorsByDefault: boolean
  pending?: boolean
  blocks?: boolean
  children: React.ReactNode
}) {
  const [colorChoice, setColorChoice] = useState<boolean>()
  const alsoColor = colorChoice ?? colorsByDefault
  return (
    <SubmitDialog
      open
      title={title}
      submitText="Apply"
      submitDisabled={!field || pending || blocks}
      onCancel={handleClose}
      onSubmit={() => {
        model.applyGroupBy(field, alsoColor)
        handleClose()
      }}
      actions={
        <Button
          onClick={() => {
            model.openPlotDialog(model.groupByPlot(field, alsoColor))
            handleClose()
          }}
        >
          Edit plot...
        </Button>
      }
    >
      <Typography color="text.secondary" gutterBottom>
        {blurb}
      </Typography>
      {children}
      <div>
        <LabeledCheckbox
          checked={alsoColor}
          onChange={setColorChoice}
          label={colorLabel}
        />
      </div>
    </SubmitDialog>
  )
})

export default GroupByDialog
