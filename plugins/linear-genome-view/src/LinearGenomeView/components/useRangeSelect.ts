import { useCallback, useState } from 'react'

import { getRelativeX } from '@jbrowse/core/util/getRelativeX'

import { useWindowDrag } from '../../shared/useWindowDrag.ts'
import { isOnScalebarRefLabel } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type React from 'react'

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
  const [startedOnRefLabel, setStartedOnRefLabel] = useState(false)

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

  useWindowDrag(ref, mouseDragging ? startX : undefined, {
    onMove: setCurrentX,
    onEnd: ({ startX, endX, isClick, clientX, clientY }) => {
      // A click on a scalebar refName label belongs to the label's own menu.
      // Drop the hover guide too: that menu covers it, and nothing else clears
      // it once the menu closes
      if (isClick && startedOnRefLabel) {
        setStartX(undefined)
        setCurrentX(undefined)
        setGuideX(undefined)
        return
      }
      setAnchorPosition({ offsetX: endX, clientX, clientY, isClick })
      if (isClick) {
        setGuideX(endX)
      } else {
        model.setOffsets(
          model.pxToBp(Math.min(startX, endX)),
          model.pxToBp(Math.max(startX, endX)),
        )
        setGuideX(undefined)
      }
    },
    onCancel: () => {
      setStartX(undefined)
      setCurrentX(undefined)
    },
  })

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (shiftOnly && !event.shiftKey) {
      return
    }
    // a press with the refName menu already open reopens it on the label under
    // the pointer; same stranded-guide reasoning as the mouseup path above
    if (model.isScalebarRefNameMenuOpen) {
      setGuideX(undefined)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    // clear any leftover menu/selection so a fresh drag isn't blocked by a
    // stale anchorPosition keeping mouseDragging false
    setAnchorPosition(undefined)
    setStartedOnRefLabel(isOnScalebarRefLabel(event.target))
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

  const isClick = anchorPosition?.isClick

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
    isClick,
    guideX,
    mouseDown,
    mouseMove,
    mouseOut,
    handleClose,
    handleMenuItemClick,
    anchorPosition,
    rubberband,
  }
}
