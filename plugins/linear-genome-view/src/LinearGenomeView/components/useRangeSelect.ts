import type React from 'react'
import { useCallback, useEffect, useState } from 'react'

import { getRelativeX } from '@jbrowse/core/util/getRelativeX'

import type { LinearGenomeViewModel } from '../index.ts'

interface AnchorPosition {
  offsetX: number
  clientX: number
  clientY: number
  // true = a click (show click menu), false = a drag-selection (show range
  // menu). Always set at construction, so it's never optional.
  isClick: boolean
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
      if (startX === undefined || !ref.current) {
        return
      }
      const { clientX, clientY } = event
      const offsetX = getRelativeX(event, ref.current)
      const isClick = Math.abs(offsetX - startX) <= 3

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
          model.pxToBp(Math.min(startX, offsetX)),
          model.pxToBp(Math.max(startX, offsetX)),
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
  }, [startX, mouseDragging, model, ref])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (shiftOnly && !event.shiftKey) {
      return
    }
    if (model.isScalebarRefNameMenuOpen) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    // clear any leftover menu/selection so a fresh drag isn't blocked by a
    // stale anchorPosition keeping mouseDragging false
    setAnchorPosition(undefined)
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

  function handleMenuItemClick(callback: () => void) {
    callback()
    handleClose()
  }

  const open = Boolean(anchorPosition)
  const isClick = anchorPosition?.isClick
  const clickBpOffset = isClick
    ? model.pxToBp(anchorPosition.offsetX)
    : undefined

  // rubberband geometry only exists while a drag is in progress (startX set);
  // grouped so a single truthiness check narrows all fields for RubberbandSpan
  let rubberband:
    | undefined
    | {
        leftBpOffset: ReturnType<LinearGenomeViewModel['pxToBp']>
        rightBpOffset: ReturnType<LinearGenomeViewModel['pxToBp']>
        numOfBpSelected: number
        width: number
        left: number
      }
  if (startX !== undefined) {
    const right = anchorPosition ? anchorPosition.offsetX : (currentX ?? startX)
    const left = Math.min(right, startX)
    const width = Math.abs(right - startX)
    rubberband = {
      leftBpOffset: model.pxToBp(left),
      rightBpOffset: model.pxToBp(left + width),
      numOfBpSelected: Math.ceil(width * model.bpPerPx),
      width,
      left,
    }
  }

  return {
    open,
    isClick,
    clickBpOffset,
    guideX,
    // true only mid-drag and not a click — drives RubberbandSpan vs guide
    rubberbandOn: rubberband !== undefined && !isClick,
    mouseDown,
    mouseMove,
    mouseOut,
    handleClose,
    handleMenuItemClick,
    anchorPosition,
    rubberband,
  }
}
