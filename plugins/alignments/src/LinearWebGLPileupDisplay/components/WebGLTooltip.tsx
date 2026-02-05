import { forwardRef, isValidElement } from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import type { Feature } from '@jbrowse/core/util'

interface Props {
  message: React.ReactNode | string
}

const TooltipContents = forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ message }, ref) {
    return (
      <div ref={ref}>
        {isValidElement(message) ? (
          message
        ) : message ? (
          <SanitizedHTML html={String(message)} />
        ) : null}
      </div>
    )
  },
)

type Coord = [number, number]

/**
 * Custom Tooltip for WebGL Pileup Display that handles CIGAR item tooltips
 * when there's no featureUnderMouse (just mouseoverExtraInformation)
 */
const WebGLTooltip = observer(function WebGLTooltip({
  model,
  clientMouseCoord,
}: {
  model: {
    featureUnderMouse: Feature | undefined
    featureIdUnderMouse: string | undefined
    mouseoverExtraInformation: string | undefined
  }
  // These are passed by BaseLinearDisplay but not used here
  height?: number
  offsetMouseCoord?: Coord
  clientMouseCoord: Coord
  clientRect?: DOMRect
  mouseCoord?: Coord
}) {
  const { featureUnderMouse, featureIdUnderMouse, mouseoverExtraInformation } =
    model
  const x = clientMouseCoord[0] + 15
  const y = clientMouseCoord[1]

  // For CIGAR items, we have mouseoverExtraInformation but no feature
  // Show the tooltip directly
  if (!featureUnderMouse && mouseoverExtraInformation) {
    return (
      <BaseTooltip clientPoint={{ x, y }}>
        <TooltipContents message={mouseoverExtraInformation} />
      </BaseTooltip>
    )
  }

  // For features, show feature info from mouseoverExtraInformation
  if (featureIdUnderMouse && mouseoverExtraInformation) {
    return (
      <BaseTooltip clientPoint={{ x, y }}>
        <TooltipContents message={mouseoverExtraInformation} />
      </BaseTooltip>
    )
  }

  return null
})

export default WebGLTooltip
