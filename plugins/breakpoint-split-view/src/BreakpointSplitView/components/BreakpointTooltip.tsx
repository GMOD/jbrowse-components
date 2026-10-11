import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

const BreakpointTooltip = observer(function BreakpointTooltip({
  lines,
}: {
  lines: string[]
}) {
  return lines.length ? (
    <BaseTooltip>
      <div style={{ whiteSpace: 'pre-wrap' }}>{lines.join('\n')}</div>
    </BaseTooltip>
  ) : null
})

export default BreakpointTooltip
