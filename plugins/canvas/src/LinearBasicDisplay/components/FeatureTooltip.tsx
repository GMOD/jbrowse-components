import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import type { MouseState } from '@jbrowse/core/ui'

const FeatureTooltip = observer(function FeatureTooltip({
  info,
  mouseState,
}: {
  info: string | undefined
  mouseState: MouseState | undefined
}) {
  return info && mouseState ? (
    <BaseTooltip
      clientPoint={{ x: mouseState.clientX, y: mouseState.clientY }}
    >
      <div>
        <SanitizedHTML html={info} />
      </div>
    </BaseTooltip>
  ) : null
})

export default FeatureTooltip
