import type React from 'react'
import { useEffect, useState } from 'react'

import { transaction } from 'mobx'

import { getRelativeX } from './util'

import type { LinearComparativeViewModel } from '../model'

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
  const [currentX, setCurrentX] = useState<number>()

  // clientX and clientY used for anchorPosition for menu
  // offsetX used for calculations about width of selection
  const [anchorPosition, setAnchorPosition] = useState<AnchorPosition>()
  const [guideX, setGuideX] = useState<number>()
  const mouseDragging = startX !== undefined && anchorPosition === undefined

  useEffect(() => {
    function computeOffsets(offsetX: number) {
      if (startX === undefined) {
        return
      }
      const leftPx = Math.min(startX, offsetX)
      const rightPx = Math.max(startX, offsetX)
      return model.views.map(view => ({
        leftOffset: view.pxToBp(leftPx),
        rightOffset: view.pxToBp(rightPx),
      }))
    }

    function globalMouseMove(event: MouseEvent) {
      if (ref.current && mouseDragging) {
        const relativeX = getRelativeX(event, ref.current)
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp(event: MouseEvent) {
      if (startX !== undefined && ref.current) {
        const { clientX, clientY } = event
        const offsetX = getRelativeX(event, ref.current)
        // as stated above, store both clientX/Y and offsetX for different
        // purposes
        setAnchorPosition({
          offsetX,
          clientX,
          clientY,
        })
        const offsets = computeOffsets(offsetX)
        if (offsets) {
          transaction(() => {
            for (const [idx, elt] of offsets.entries()) {
              model.views[idx]!.setOffsets(elt.leftOffset, elt.rightOffset)
            }
          })
        }
        setGuideX(undefined)
      }
    }
    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove)
      window.addEventListener('mouseup', globalMouseUp)
      return () => {
        window.removeEventListener('mousemove', globalMouseMove)
        window.removeEventListener('mouseup', globalMouseUp)
      }
    }
    return () => {}
  }, [startX, mouseDragging, model, ref])

  useEffect(() => {
    if (
      !mouseDragging &&
      currentX !== undefined &&
      startX !== undefined &&
      Math.abs(currentX - startX) <= 3
    ) {
      handleClose()
    }
  }, [mouseDragging, currentX, startX])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const relativeX = getRelativeX(event, ref.current)
    setStartX(relativeX)
    setCurrentX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
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

  function handleClose() {
    setAnchorPosition(undefined)
    setStartX(undefined)
    setCurrentX(undefined)
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
  const right = anchorPosition ? anchorPosition.offsetX : currentX || 0
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
