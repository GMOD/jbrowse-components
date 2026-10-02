import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'
import BottomRightIndicators from '@jbrowse/display-kit/BottomRightIndicators'
import ConfigProblemsIndicator from '@jbrowse/display-kit/ConfigProblemsIndicator'
import { observer } from 'mobx-react'

const VariantConfigProblems = observer(function VariantConfigProblems({
  model,
}: {
  model: { notices: readonly string[]; scrollableHeight: number }
}) {
  return (
    <BottomRightIndicators
      scrollbarWidth={
        model.scrollableHeight > 0 ? VERTICAL_SCROLLBAR_CLEARANCE : 0
      }
    >
      <ConfigProblemsIndicator notices={model.notices} />
    </BottomRightIndicators>
  )
})

export default VariantConfigProblems
