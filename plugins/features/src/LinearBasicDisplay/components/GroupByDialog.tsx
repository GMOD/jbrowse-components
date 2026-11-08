import { useState } from 'react'

import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import GroupByDialogShell from '@jbrowse/display-kit/GroupByDialog'
import { colorsWithGrouping } from '@jbrowse/display-kit/groupByMenu'
import { observer } from 'mobx-react'

import AttributeFieldInput from './AttributeFieldInput.tsx'
import { GROUPING } from './attributeVerdict.ts'

import type { AttributeScanModel } from './AttributeFieldInput.tsx'
import type { GroupByPlotHost } from '@jbrowse/display-kit/GroupByDialog'

export interface GroupByDialogModel
  extends AttributeScanModel, GroupByPlotHost {
  facet: { field: string } | undefined
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
  const field = attribute.trim() || undefined
  return (
    <GroupByDialogShell
      model={model}
      handleClose={handleClose}
      title="Group by attribute"
      blurb="Packs the features into labelled sections, one per value of the attribute, stacked in this track."
      colorLabel="Also color by this attribute"
      field={field}
      colorsByDefault={colorsWithGrouping({
        value: color,
        colorField,
        field: field ?? current,
      })}
    >
      <AttributeFieldInput
        model={model}
        value={attribute}
        onChange={setAttribute}
        use={GROUPING}
        testid="group-by-attribute"
        placeholder="e.g. biotype"
      />
    </GroupByDialogShell>
  )
})

export default GroupByDialog
