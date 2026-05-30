import type React from 'react'
import { useCallback, useEffect, useEffectEvent, useState } from 'react'

import { getRelativeX } from '@jbrowse/core/util/getRelativeX'
import { transaction } from 'mobx'

import type { BreakpointViewModel } from '../model.ts'

interface AnchorPosition {
  offsetX: number
  clientX: number
  clientY: number
}

export function useRangeSelect(
  ref: React.RefObject<HTMLDivElement | null>,
  model: BreakpointViewModel,
) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState(0)
  const [anchorPosition, setAnchorPosition] = useState<AnchorPosition>()
  const [guideX, setGuideX] = useState<number>()
  const mouseDragging = startX !== undefined && anchorPosition === undefined

  const handleClose = useCallback(() => {
    setAnchorPosition(undefined)
    setStartX(undefined)
    setCurrentX(0)
  }, [])

  const globalMouseMove = useEffectEvent((event: MouseEvent) => {
    if (ref.current) {
      setCurrentX(getRelativeX(event, ref.current))
    }
  })

  const globalMouseUp = useEffectEvent((event: MouseEvent) => {
    if (startX === undefined || !ref.current) {
      return
    }
    const offsetX = getRelativeX(event, ref.current)
    if (Math.abs(offsetX - startX) <= 3) {
      handleClose()
      return
    }
    setAnchorPosition({ offsetX, clientX: event.clientX, clientY: event.clientY })
    const leftPx = Math.min(startX, offsetX)
    const rightPx = Math.max(startX, offsetX)
    transaction(() => {
      for (const view of model.views) {
        view.setOffsets(view.pxToBp(leftPx), view.pxToBp(rightPx))
      }
    })
    setGuideX(undefined)
  })

  useEffect(() => {
    if (!mouseDragging) {
      return
    }
    window.addEventListener('mousemove', globalMouseMove)
    window.addEventListener('mouseup', globalMouseUp)
    return () => {
      window.removeEventListener('mousemove', globalMouseMove)
      window.removeEventListener('mouseup', globalMouseUp)
    }
  }, [mouseDragging])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const relativeX = getRelativeX(event, ref.current)
    setStartX(relativeX)
    setCurrentX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    // Don't update guideX while the menu is open (rubberband locked)
    if (anchorPosition) {
      return
    }
    setGuideX(getRelativeX(event, ref.current))
  }

  function mouseOut() {
    setGuideX(undefined)
    transaction(() => {
      for (const view of model.views) {
        view.setOffsets(undefined, undefined)
      }
    })
  }

  function handleMenuItemClick(_: unknown, callback: () => void) {
    callback()
    handleClose()
  }

  const rubberbandOn = startX !== undefined
  const right = anchorPosition?.offsetX ?? currentX
  const left = rubberbandOn ? Math.min(right, startX) : 0
  const width = rubberbandOn ? Math.abs(right - startX) : 0
  const views = rubberbandOn ? model.views : []

  return {
    open: Boolean(anchorPosition),
    rubberbandOn,
    guideX,
    anchorPosition,
    left,
    width,
    leftBpOffset: views.map(v => v.pxToBp(left)),
    rightBpOffset: views.map(v => v.pxToBp(left + width)),
    numOfBpSelected: views.map(v => Math.ceil(width * v.bpPerPx)),
    mouseDown,
    mouseMove,
    mouseOut,
    handleClose,
    handleMenuItemClick,
  }
}
