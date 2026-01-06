import type React from 'react'
import { useCallback, useEffect, useState } from 'react'

import { getRelativeX } from './util.ts'

import type { LinearGenomeViewModel } from '..'

interface AnchorPosition {
  offsetX: number
  clientX: number
  clientY: number
  isClick?: boolean
}

export function useRangeSelect(
  ref: React.RefObject<HTMLDivElement | null>,
  model: LinearGenomeViewModel,
  shiftOnly?: boolean,
) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()

  // clientX and clientY used for anchorPosition for menu
  // offsetX used for calculations about width of selection
  const [anchorPosition, setAnchorPosition] = useState<AnchorPosition>()
  const [guideX, setGuideX] = useState<number>()
  const mouseDragging = startX !== undefined && anchorPosition === undefined

  const handleClose = useCallback(() => {
    setAnchorPosition(undefined)
    setStartX(undefined)
    setCurrentX(undefined)
  }, [])

  useEffect(() => {
    function computeOffsets(offsetX: number) {
      if (startX === undefined) {
        return
      }
      const leftPx = Math.min(startX, offsetX)
      const rightPx = Math.max(startX, offsetX)
      return {
        leftOffset: model.pxToBp(leftPx),
        rightOffset: model.pxToBp(rightPx),
      }
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
        const isClick = Math.abs(offsetX - startX) <= 3
        // store both clientX/Y and offsetX for different purposes
        setAnchorPosition({
          offsetX,
          clientX,
          clientY,
          isClick,
        })
        if (!isClick) {
          const args = computeOffsets(offsetX)
          if (args) {
            model.setOffsets(args.leftOffset, args.rightOffset)
          }
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
  }, [startX, mouseDragging, model, ref, handleClose])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (shiftOnly && !event.shiftKey) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const relativeX = getRelativeX(event, ref.current)
    setStartX(relativeX)
    setCurrentX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (shiftOnly) {
      if (event.shiftKey) {
        setGuideX(getRelativeX(event, ref.current))
      } else {
        setGuideX(undefined)
      }
    } else {
      setGuideX(getRelativeX(event, ref.current))
    }
  }

  function mouseOut() {
    setGuideX(undefined)
  }

  function handleMenuItemClick(_: unknown, callback: () => void) {
    callback()
    handleClose()
  }

  const open = Boolean(anchorPosition)
  const isClick = anchorPosition?.isClick
  const clickBpOffset = isClick
    ? model.pxToBp(anchorPosition.offsetX)
    : undefined

  if (startX === undefined) {
    return {
      open,
      isClick,
      clickBpOffset,
      guideX,
      mouseDown,
      mouseMove,
      mouseOut,
      handleClose,
      handleMenuItemClick,
      anchorPosition,
    }
  }
  const right = anchorPosition ? anchorPosition.offsetX : currentX || 0
  const left = Math.min(right, startX)
  const width = Math.abs(right - startX)
  const leftBpOffset = model.pxToBp(left)
  const rightBpOffset = model.pxToBp(left + width)
  const numOfBpSelected = Math.ceil(width * model.bpPerPx)

  return {
    open,
    isClick,
    clickBpOffset,
    rubberbandOn: !isClick,
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
