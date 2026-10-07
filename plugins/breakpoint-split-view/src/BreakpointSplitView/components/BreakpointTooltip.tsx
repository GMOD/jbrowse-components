import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

const BreakpointTooltip = observer(function BreakpointTooltip({
  contents,
}: {
  contents?: string
}) {
  return contents ? (
    <BaseTooltip>
      <div>
        <SanitizedHTML html={contents} />
      </div>
    </BaseTooltip>
  ) : null
})

export default BreakpointTooltip
