import { useEffect, useState } from 'react'

import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { RefObject } from 'react'

// MUI's window after a tooltip closes in which the next opens at once
const HYSTERESIS_MS = 800

// a row with a description; an undescribed track still carries an empty
// data-tooltip, which must open nothing and so start no no-delay window
const DESCRIBED = '[data-tooltip]:not([data-tooltip=""])'

const SharedTooltip = observer(function SharedTooltip({
  containerRef,
  model,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  model: HierarchicalTrackSelectorModel
}) {
  const [state, setState] = useState<{
    anchorEl: HTMLElement
    text: string
  } | null>(null)

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

    const show = (target: HTMLElement) => {
      shown = target
      setState({ anchorEl: target, text: target.dataset.tooltip ?? '' })
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
      const target = (e.target as HTMLElement).closest<HTMLElement>(DESCRIBED)
      // mouseover fires again for every descendant crossed, so keep the state
      // while the row is unchanged. A row virtualized away under the pointer
      // gets no mouseout, so landing anywhere without a tooltip clears it
      if (!target) {
        hide()
      } else if (target !== shown) {
        clearTimeout(pending)
        if (
          !enterDelay ||
          shown ||
          performance.now() - closedAt < HYSTERESIS_MS
        ) {
          show(target)
        } else {
          // a row virtualized away during the wait anchors nowhere
          pending = setTimeout(() => {
            if (target.isConnected) {
              show(target)
            }
          }, enterDelay)
        }
      }
    }

    const handleOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(DESCRIBED)
      const related = (e.relatedTarget as HTMLElement | null)?.closest(
        DESCRIBED,
      )
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

  if (!state?.text) {
    return null
  }

  return (
    <Tooltip
      open
      title={<SanitizedHTML html={state.text} />}
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
