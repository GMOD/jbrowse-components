import { useEffect, useState } from 'react'

import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { RefObject } from 'react'

// MUI's window after a tooltip closes in which the next opens at once
const HYSTERESIS_MS = 800

const TOOLTIP = '[data-tooltip]'

interface TooltipText {
  /** the cut-off text in full, as plain text */
  full: string
  /** the element's own data-tooltip, which may be HTML */
  description: string
}

// an element's hover text: its cut-off text (a [data-clip], itself or inside
// it) in full, then its own data-tooltip. An element with neither, such as an
// undescribed track whose name fits, opens nothing and so starts no no-delay
// window
function tooltipText(target: HTMLElement): TooltipText {
  const clip =
    target.dataset.clip === undefined
      ? target.querySelector<HTMLElement>('[data-clip]')
      : target
  return {
    full: clip && clip.scrollWidth > clip.clientWidth ? clip.textContent : '',
    description: target.dataset.tooltip ?? '',
  }
}

const SharedTooltip = observer(function SharedTooltip({
  containerRef,
  model,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  model: HierarchicalTrackSelectorModel
}) {
  const [state, setState] = useState<
    (TooltipText & { anchorEl: HTMLElement }) | null
  >(null)

  // MUI's own Tooltip waits the theme's enterDelay, and once one has shown
  // its neighbours open at once; this controlled one does the same, so a
  // pointer crossing the list on its way elsewhere opens nothing
  const enterDelay = useTheme().components?.MuiTooltip?.defaultProps?.enterDelay
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    let shown: HTMLElement | undefined
    let closedAt = Number.NEGATIVE_INFINITY
    let pending: ReturnType<typeof setTimeout> | undefined

    const show = (target: HTMLElement, text: TooltipText) => {
      shown = target
      setState({ anchorEl: target, ...text })
    }
    const hide = () => {
      clearTimeout(pending)
      if (shown) {
        shown = undefined
        closedAt = performance.now()
      }
      setState(null)
    }

    const handleOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(TOOLTIP)
      const text = target ? tooltipText(target) : undefined
      // mouseover fires again for every descendant crossed, so keep the state
      // while the row is unchanged. A row virtualized away under the pointer
      // gets no mouseout, so landing anywhere without a tooltip clears it
      if (!target || !text || (!text.full && !text.description)) {
        hide()
      } else if (target !== shown) {
        clearTimeout(pending)
        if (
          !enterDelay ||
          shown ||
          performance.now() - closedAt < HYSTERESIS_MS
        ) {
          show(target, text)
        } else {
          // a row virtualized away during the wait anchors nowhere
          pending = setTimeout(() => {
            if (target.isConnected) {
              show(target, text)
            }
          }, enterDelay)
        }
      }
    }

    const handleOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(TOOLTIP)
      const related = (e.relatedTarget as HTMLElement | null)?.closest(TOOLTIP)
      if (target && target !== related) {
        hide()
      }
    }

    container.addEventListener('mouseover', handleOver)
    container.addEventListener('mouseout', handleOut)
    return () => {
      clearTimeout(pending)
      container.removeEventListener('mouseover', handleOver)
      container.removeEventListener('mouseout', handleOut)
    }
  }, [containerRef, enterDelay])

  const placement =
    getSession(model).drawerPosition === 'left' ? 'right' : 'left'

  if (!state) {
    return null
  }

  return (
    <Tooltip
      open
      title={
        <>
          {state.full ? <div>{state.full}</div> : null}
          {state.description ? (
            <SanitizedHTML html={state.description} />
          ) : null}
        </>
      }
      placement={placement}
      slotProps={{
        popper: {
          anchorEl: state.anchorEl,
        },
      }}
    >
      <span />
    </Tooltip>
  )
})

export default SharedTooltip
