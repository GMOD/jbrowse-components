import { useCallback, useEffect, useState } from 'react'

import { getRelativeX } from '@jbrowse/core/util/getRelativeX'
import { transaction } from 'mobx'

import type { MultiLevelRubberbandModel } from './types.ts'
import type React from 'react'

interface AnchorPosition {
  offsetX: number
  clientX: number
  clientY: number
}

export function useRangeSelect(
  ref: React.RefObject<HTMLDivElement | null>,
  model: MultiLevelRubberbandModel,
) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState(0)
  const [anchorPosition, setAnchorPosition] = useState<AnchorPosition>()
  const [guideX, setGuideX] = useState<number>()
  const mouseDragging = startX !== undefined && anchorPosition === undefined

  // one selection spans every level, so it is released from all of them at once.
  // Committing is not the mirror of this and stays inline below: each level maps
  // the same pixels through its own pxToBp, so the offsets differ per view.
  const clearOffsets = useCallback(() => {
    transaction(() => {
      for (const view of model.views) {
        view.setOffsets(undefined, undefined)
      }
    })
  }, [model])

  // releases the committed offsets too, since mouseOut no longer does while the
  // menu is open — closing the menu (button, Escape, or a bare click) is the
  // point the selection is actually finished with
  const handleClose = useCallback(() => {
    setAnchorPosition(undefined)
    setStartX(undefined)
    setCurrentX(0)
    setGuideX(undefined)
    clearOffsets()
  }, [clearOffsets])

  useEffect(() => {
    const el = ref.current
    if (!mouseDragging || !el) {
      return
    }
    // the container's left edge is fixed for the duration of a drag, so measure
    // it once here rather than calling getBoundingClientRect on every mousemove
    const { left } = el.getBoundingClientRect()

    function globalMouseMove(event: MouseEvent) {
      setCurrentX(event.clientX - left)
    }

    function globalMouseUp(event: MouseEvent) {
      if (startX === undefined) {
        return
      }
      const offsetX = event.clientX - left
      if (Math.abs(offsetX - startX) <= 3) {
        handleClose()
        return
      }
      setAnchorPosition({
        offsetX,
        clientX: event.clientX,
        clientY: event.clientY,
      })
      const leftPx = Math.min(startX, offsetX)
      const rightPx = Math.max(startX, offsetX)
      transaction(() => {
        for (const view of model.views) {
          view.setOffsets(view.pxToBp(leftPx), view.pxToBp(rightPx))
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
    // clear any leftover menu/selection so a fresh drag isn't blocked by a
    // stale anchorPosition keeping mouseDragging false
    setAnchorPosition(undefined)
    // the guide is what the pointer was showing up to now, and mouseMove won't
    // touch it during the drag — leaving it set keeps the selection span from
    // ever rendering, since the guide wins that either/or
    setGuideX(undefined)
    const relativeX = getRelativeX(event, ref.current)
    setStartX(relativeX)
    setCurrentX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    // Don't update guideX while the menu is open (rubberband locked) or while a
    // drag-selection is in progress (the rubberband should show, not the guide)
    if (anchorPosition || mouseDragging) {
      return
    }
    setGuideX(getRelativeX(event, ref.current))
  }

  function mouseOut() {
    // Leave both the guide and the committed offsets alone once the menu is up
    // (anchorPosition) or a drag is running: the offsets are exactly what the
    // menu's items act on, and moving the pointer off the strip toward the menu
    // used to clear them out from under it — "Zoom to region" then no-opped and
    // "Get sequence" saw no regions.
    if (!anchorPosition && !mouseDragging) {
      setGuideX(undefined)
      clearOffsets()
    }
  }

  function handleMenuItemClick(callback: () => void) {
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
