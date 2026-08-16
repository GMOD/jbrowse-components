import { SanitizedHTML } from '@jbrowse/core/ui'
import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { observer } from 'mobx-react'

import type { MouseState } from '@jbrowse/core/ui'

const FeatureTooltip = observer(function FeatureTooltip({
  info,
  mouseState,
}: {
  info: string | undefined
  mouseState: MouseState | undefined
}) {
  return (
    <HoverTooltip hit={info} mouseState={mouseState}>
      <div>{info ? <SanitizedHTML html={info} /> : null}</div>
    </HoverTooltip>
  )
})

export default FeatureTooltip
