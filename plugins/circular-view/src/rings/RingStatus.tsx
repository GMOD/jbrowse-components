import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { measureText } from '@jbrowse/core/util'
import { tooLargeBannerText } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { ringLabelArcPath } from './ringPolar.ts'

import type { Ring } from './ringHost.ts'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

const FONT_SIZE_PX = 11

interface StatusDisplay {
  displayPhase: DisplayPhase
  regionTooLargeReason?: string
  zoomCanReleaseGate?: boolean
  error?: unknown
  renderError?: unknown
  forceLoad?: () => void
  reload?: () => void
}

function hasPhase(display: object): display is StatusDisplay {
  return 'displayPhase' in display
}

function ringStatus(display: StatusDisplay) {
  const phase = display.displayPhase
  if (phase === 'tooLarge') {
    return {
      text: tooLargeBannerText(display.regionTooLargeReason ?? '', {
        zoomCanRelease: display.zoomCanReleaseGate,
      }),
      short: display.regionTooLargeReason || 'Too much data to show',
      action: display.forceLoad,
      actionLabel: 'click to force load',
      isError: false,
    }
  }
  if (phase === 'error' || phase === 'renderError') {
    const message = String(
      phase === 'error' ? display.error : display.renderError,
    )
    return {
      text: message,
      short: message,
      action: phase === 'error' ? display.reload : undefined,
      actionLabel: 'click to retry',
      isError: true,
    }
  }
  return undefined
}

/** The first of `candidates` that fits the arc a label path can take. */
function fitting(candidates: string[], radiusPx: number) {
  const room = 1.2 * radiusPx
  return (
    candidates.find(t => measureText(t, FONT_SIZE_PX) <= room) ??
    candidates.at(-1)!
  )
}

const RingStatusLine = observer(function RingStatusLine({
  ring,
  offsetRadians,
  idPrefix,
}: {
  ring: Ring
  offsetRadians: number
  idPrefix: string
}) {
  const palette = usePalette()
  const { display, innerPx, outerPx } = ring
  const status = hasPhase(display) ? ringStatus(display) : undefined
  if (!status) {
    return null
  }
  const { text, short, action, actionLabel, isError } = status
  const radiusPx = (innerPx + outerPx) / 2
  const line = fitting(
    action ? [`${short} (${actionLabel})`, short] : [short],
    radiusPx,
  )
  const turn = measureText(line, FONT_SIZE_PX) / radiusPx
  const id = `${idPrefix}-status`
  return (
    <g data-testid="ring-status">
      <circle
        r={radiusPx}
        fill="none"
        stroke={isError ? palette.error.light : palette.action.hover}
        strokeOpacity={isError ? 0.35 : 1}
        strokeWidth={outerPx - innerPx}
        pointerEvents="none"
      />
      <path
        id={id}
        d={ringLabelArcPath(
          { radians: -Math.PI / 2 - offsetRadians, turn, radiusPx },
          false,
        )}
        fill="none"
      />
      <text
        fontSize={FONT_SIZE_PX}
        fill={isError ? palette.error.main : palette.text.secondary}
        dominantBaseline="middle"
        style={action ? { cursor: 'pointer' } : undefined}
        pointerEvents={action ? 'auto' : 'none'}
        onPointerDown={event => {
          if (action) {
            event.stopPropagation()
          }
        }}
        onClick={event => {
          if (action) {
            event.stopPropagation()
            action()
          }
        }}
      >
        <textPath xlinkHref={`#${id}`} startOffset="50%" textAnchor="middle">
          {line}
        </textPath>
        <title>{text}</title>
      </text>
    </g>
  )
})

/**
 * A ring whose display is gated or failed says so in its band, read level at
 * the top of the screen, where the linear track would show its banner: the
 * banner lives in the hidden strip the ring is warped from, so its message and
 * its Force load button never reach the circle.
 */
export const RingStatus = observer(function RingStatus({
  model,
}: {
  model: {
    id: string
    offsetRadians: number
    ringHost: { rings: readonly Ring[] }
  }
}) {
  const { ringHost, offsetRadians, id } = model
  return ringHost.rings.map(ring => (
    <RingStatusLine
      key={ring.display.id}
      ring={ring}
      offsetRadians={offsetRadians}
      idPrefix={`ring-${id}-${ring.display.id}`}
    />
  ))
})
