import { useState } from 'react'

import { LabeledCheckbox, SubmitDialog } from '@jbrowse/core/ui'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { colorsWithGrouping } from '../groupByColor.ts'
import AttributeFieldInput from './AttributeFieldInput.tsx'
import { GROUPING } from './attributeVerdict.ts'

import type { AttributeScanModel } from './AttributeFieldInput.tsx'
import type { Plot } from '@jbrowse/core/configuration'

export interface GroupByDialogModel extends AttributeScanModel {
  facet: { field: string } | undefined
  applyGroupBy: (field: string | undefined, color: boolean) => void
  groupByPlot: (field: string | undefined, color: boolean) => Plot
  openPlotDialog: (seed?: Plot) => void
}

const GroupByDialog = observer(function GroupByDialog({
  model,
  handleClose,
  color,
  colorField,
}: {
  model: GroupByDialogModel
  handleClose: () => void
  color: string | undefined
  colorField: string | undefined
}) {
  const current = model.facet?.field
  const [attribute, setAttribute] = useState(
    current === STRAND_FIELD ? '' : (current ?? ''),
  )
  const [colorChoice, setColorChoice] = useState<boolean>()
  const field = attribute.trim() || undefined
  const alsoColor =
    colorChoice ?? colorsWithGrouping(color, colorField, field ?? current)

  return (
    <SubmitDialog
      open
      title="Group by attribute"
      submitText="Apply"
      submitDisabled={!field}
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
        Packs the features into labelled sections, one per value of the
        attribute, stacked in this track.
      </Typography>
      <AttributeFieldInput
        model={model}
        value={attribute}
        onChange={setAttribute}
        use={GROUPING}
        testid="group-by-attribute"
        placeholder="e.g. biotype"
      />
      <div>
        <LabeledCheckbox
          checked={alsoColor}
          onChange={setColorChoice}
          label="Also color by this attribute"
        />
      </div>
    </SubmitDialog>
  )
})

export default GroupByDialog
