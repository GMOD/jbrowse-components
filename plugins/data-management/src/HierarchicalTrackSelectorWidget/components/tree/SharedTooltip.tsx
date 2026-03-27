import { type RefObject, useEffect, useState } from 'react'

import { Tooltip } from '@mui/material'

export default function SharedTooltip({
  containerRef,
  placement,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  placement: 'left' | 'right'
}) {
  const [state, setState] = useState<{
    anchorEl: HTMLElement
    text: string
  } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-tooltip]',
      )
      if (target) {
        setState({ anchorEl: target, text: target.dataset.tooltip ?? '' })
      }
    }

    const handleOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]')
      const related = (e.relatedTarget as HTMLElement | null)?.closest(
        '[data-tooltip]',
      )
      if (target && target !== related) {
        setState(null)
      }
    }

    container.addEventListener('mouseover', handleOver)
    container.addEventListener('mouseout', handleOut)
    return () => {
      container.removeEventListener('mouseover', handleOver)
      container.removeEventListener('mouseout', handleOut)
    }
  }, [containerRef])

  if (!state?.text) {
    return null
  }

  return (
    <Tooltip
      open
      title={state.text}
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
}
