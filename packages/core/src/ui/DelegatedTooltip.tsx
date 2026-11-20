import { useEffect, useState } from 'react'

import { Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import SanitizedHTML from './SanitizedHTML.tsx'

import type { TooltipProps } from '@mui/material'
import type { RefObject } from 'react'

// MUI's window after a tooltip closes in which the next opens at once
const HYSTERESIS_MS = 800

const TOOLTIP = '[data-tooltip], [data-tooltip-html]'

interface TooltipText {
  /** the cut-off text in full */
  full: string
  /** the element's data-tooltip, as plain text */
  text: string
  /** the element's data-tooltip-html */
  html: string
}

// an element's hover text: its cut-off text (a [data-clip], itself or inside
// it) in full, then its own data-tooltip or data-tooltip-html. A text that
// only repeats the clip's own words adds nothing, so a value that fits opens
// nothing and starts no no-delay window
function tooltipText(target: HTMLElement): TooltipText {
  const clip =
    target.dataset.clip === undefined
      ? target.querySelector<HTMLElement>('[data-clip]')
      : target
  const text = target.dataset.tooltip ?? ''
  return {
    full: clip && clip.scrollWidth > clip.clientWidth ? clip.textContent : '',
    text: text === clip?.textContent ? '' : text,
    html: target.dataset.tooltipHtml ?? '',
  }
}

/**
 * One tooltip for every element under a container that asks for one with
 * `data-tooltip` (plain text) or `data-tooltip-html`, so a long list or table
 * mounts one MUI Tooltip rather than one per row. Text a `data-clip` element
 * cuts with an ellipsis shows in full first.
 */
const DelegatedTooltip = observer(function DelegatedTooltip({
  containerRef,
  placement = 'top',
}: {
  containerRef: RefObject<HTMLElement | null>
  placement?: TooltipProps['placement']
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
      if (!target || !text || (!text.full && !text.text && !text.html)) {
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

  return state ? (
    <Tooltip
      open
      title={
        <>
          {state.full ? <div>{state.full}</div> : null}
          {state.text ? <div>{state.text}</div> : null}
          {state.html ? <SanitizedHTML html={state.html} /> : null}
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
  ) : null
})

export default DelegatedTooltip
