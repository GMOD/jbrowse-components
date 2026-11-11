import { SidebarHintChip } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import LinearMarkDisplayComponent from '../../LinearMarkDisplay/components/LinearMarkDisplayComponent.tsx'

import type { MarkTooltipModel } from '../../LinearMarkDisplay/components/MarkTooltip.tsx'
import type { MarkDisplayModel } from '../../LinearMarkDisplay/components/markDisplayTypes.ts'

type MultiRowDisplayModel = MarkDisplayModel &
  MarkTooltipModel & {
    rowsHint: { title: string; text: string } | undefined
    openRowsFieldDialog: () => void
  }

/**
 * The mark display's plot, with a chip at the head of the rows while no
 * attribute splits them, which opens the One row per picker.
 */
const LinearMultiRowFeatureDisplayComponent = observer(
  function LinearMultiRowFeatureDisplayComponent({
    model,
  }: {
    model: MultiRowDisplayModel
  }) {
    return (
      <LinearMarkDisplayComponent model={model}>
        <SidebarHintChip
          top={model.plotBox.yTop}
          testId="rows_field_hint"
          hint={model.rowsHint}
          onClick={() => {
            model.openRowsFieldDialog()
          }}
        />
      </LinearMarkDisplayComponent>
    )
  },
)

export default LinearMultiRowFeatureDisplayComponent
