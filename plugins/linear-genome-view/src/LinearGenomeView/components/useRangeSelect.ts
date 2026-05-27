import type React from 'react'
import { useCallback, useEffect, useState } from 'react'

import { getRelativeX } from '@jbrowse/core/util/getRelativeX'
import useLatestRef from '@jbrowse/core/util/useLatestRef'

import type { LinearGenomeViewModel } from '../index.ts'

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

  const startXRef = useLatestRef(startX)

  const handleClose = useCallback(() => {
    setAnchorPosition(undefined)
    setStartX(undefined)
    setCurrentX(undefined)
    setGuideX(undefined)
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
      const sx = startXRef.current
      if (sx === undefined || !ref.current) {
        return
      }
      const { clientX, clientY } = event
      const offsetX = getRelativeX(event, ref.current)
      const isClick = Math.abs(offsetX - sx) <= 3

      // If click started on a scalebar refname label, let that component
      // handle it instead of showing the rubberband menu
      if (isClick && model.scalebarRefNameClickPending) {
        setStartX(undefined)
        setCurrentX(undefined)
        return
      }

      if (!isClick && model.scalebarRefNameClickPending) {
        model.setScalebarRefNameClickPending(false)
      }

      setAnchorPosition({ offsetX, clientX, clientY, isClick })
      if (isClick) {
        setGuideX(offsetX)
      } else {
        model.setOffsets(
          model.pxToBp(Math.min(sx, offsetX)),
          model.pxToBp(Math.max(sx, offsetX)),
        )
        setGuideX(undefined)
      }
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setStartX(undefined)
        setCurrentX(undefined)
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
  }, [mouseDragging, model, ref])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (shiftOnly && !event.shiftKey) {
      return
    }
    if (model.isScalebarRefNameMenuOpen) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const relativeX = getRelativeX(event, ref.current)
    setStartX(relativeX)
    setCurrentX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    // Keep the rubberband visible while a drag-selection menu is open
    if (anchorPosition?.isClick === false) {
      return
    }
    const wantsGuide = !mouseDragging && (!shiftOnly || event.shiftKey)
    setGuideX(wantsGuide ? getRelativeX(event, ref.current) : undefined)
  }

  function mouseOut() {
    if (!anchorPosition?.isClick) {
      setGuideX(undefined)
    }
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
  const right = anchorPosition ? anchorPosition.offsetX : (currentX ?? 0)
  const left = Math.min(right, startX)
  const width = Math.abs(right - startX)
  const leftBpOffset = model.pxToBp(left)
  const rightBpOffset = model.pxToBp(left + width)
  const numOfBpSelected = Math.ceil(width * model.bpPerPx)

  return {
    open,
    isClick,
    clickBpOffset,
    guideX,
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
