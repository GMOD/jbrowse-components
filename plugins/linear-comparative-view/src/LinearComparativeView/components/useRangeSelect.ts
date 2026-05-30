import type React from 'react'
import { useCallback, useEffect, useState } from 'react'

import { getRelativeX } from '@jbrowse/core/util/getRelativeX'
import { transaction } from 'mobx'

import type { LinearComparativeViewModel } from '../model.ts'

interface AnchorPosition {
  offsetX: number
  clientX: number
  clientY: number
}

export function useRangeSelect(
  ref: React.RefObject<HTMLDivElement | null>,
  model: LinearComparativeViewModel,
) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState(0)

  // clientX and clientY used for anchorPosition for menu
  // offsetX used for calculations about width of selection
  const [anchorPosition, setAnchorPosition] = useState<AnchorPosition>()
  const [guideX, setGuideX] = useState<number>()
  const mouseDragging = startX !== undefined && anchorPosition === undefined

  const handleClose = useCallback(() => {
    setAnchorPosition(undefined)
    setStartX(undefined)
    setCurrentX(0)
  }, [])

  useEffect(() => {
    if (!mouseDragging) {
      return
    }

    function globalMouseMove(event: MouseEvent) {
      if (ref.current) {
        setCurrentX(getRelativeX(event, ref.current))
      }
    }

    function globalMouseUp(event: MouseEvent) {
      if (startX === undefined || !ref.current) {
        return
      }
      const { clientX, clientY } = event
      const offsetX = getRelativeX(event, ref.current)
      if (Math.abs(offsetX - startX) <= 3) {
        handleClose()
        return
      }
      setAnchorPosition({ offsetX, clientX, clientY })
      const leftPx = Math.min(startX, offsetX)
      const rightPx = Math.max(startX, offsetX)
      const offsets = model.views.map(view => ({
        leftOffset: view.pxToBp(leftPx),
        rightOffset: view.pxToBp(rightPx),
      }))
      transaction(() => {
        for (const [idx, elt] of offsets.entries()) {
          model.views[idx]!.setOffsets(elt.leftOffset, elt.rightOffset)
        }
      })
      setGuideX(undefined)
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('mousemove', globalMouseMove)
    window.addEventListener('mouseup', globalMouseUp)
    window.addEventListener('keydown', globalKeyDown)
    return () => {
      window.removeEventListener('mousemove', globalMouseMove)
      window.removeEventListener('mouseup', globalMouseUp)
      window.removeEventListener('keydown', globalKeyDown)
    }
  }, [startX, mouseDragging, model, ref, handleClose])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const relativeX = getRelativeX(event, ref.current)
    setStartX(relativeX)
    setCurrentX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    // If we have a rubberband selection active (menu is open), don't update guideX
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

  const open = Boolean(anchorPosition)
  if (startX === undefined) {
    return {
      open,
      guideX,
      mouseDown,
      mouseMove,
      mouseOut,
      handleMenuItemClick,
    }
  }
  const right = anchorPosition?.offsetX ?? currentX
  const left = Math.min(right, startX)
  const width = Math.abs(right - startX)
  const leftBpOffset = model.views.map(view => view.pxToBp(left))
  const rightBpOffset = model.views.map(view => view.pxToBp(left + width))
  const numOfBpSelected = model.views.map(view =>
    Math.ceil(width * view.bpPerPx),
  )

  return {
    open,
    rubberbandOn: true,
    mouseDown,
    mouseMove,
    mouseOut,
    handleClose,
    handleMenuItemClick,
    leftBpOffset,
    rightBpOffset,
    anchorPosition,
    numOfBpSelected,
    width,
    left,
  }
}
