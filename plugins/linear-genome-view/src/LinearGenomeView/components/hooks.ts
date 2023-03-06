import React, { useRef, useEffect, useState } from 'react'
import normalizeWheel from 'normalize-wheel'

// locals
import { LinearGenomeViewModel } from '..'
import { getRelativeX } from './util'

type LGV = LinearGenomeViewModel
type Timer = ReturnType<typeof setTimeout>

export function useSideScroll(model: LGV) {
  const [mouseDragging, setMouseDragging] = useState(false)
  // refs are to store these variables to avoid repeated rerenders associated
  // with useState/setState
  const scheduled = useRef(false)

  const prevX = useRef<number>(0)

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      const currX = event.clientX
      const distance = currX - prevX.current
      if (distance) {
        // use rAF to make it so multiple event handlers aren't fired per-frame
        // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
        if (!scheduled.current) {
          scheduled.current = true
          window.requestAnimationFrame(() => {
            model.horizontalScroll(-distance)
            scheduled.current = false
            prevX.current = event.clientX
          })
        }
      }
    }

    function globalMouseUp() {
      prevX.current = 0
      if (mouseDragging) {
        setMouseDragging(false)
      }
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove, true)
      window.addEventListener('mouseup', globalMouseUp, true)
      cleanup = () => {
        window.removeEventListener('mousemove', globalMouseMove, true)
        window.removeEventListener('mouseup', globalMouseUp, true)
      }
    }
    return cleanup
  }, [model, mouseDragging, prevX])

  function mouseDown(event: React.MouseEvent) {
    if (event.shiftKey) {
      return
    }
    // check if clicking a draggable element or a resize handle
    const target = event.target as HTMLElement
    if (target.draggable || target.dataset.resizer) {
      return
    }

    // otherwise do click and drag scroll
    if (event.button === 0) {
      prevX.current = event.clientX
      setMouseDragging(true)
    }
  }

  // this local mouseup is used in addition to the global because sometimes
  // the global add/remove are not called in time, resulting in issue #533
  function mouseUp(event: React.MouseEvent) {
    event.preventDefault()
    setMouseDragging(false)
  }
  return { mouseDown, mouseUp }
}

interface AnchorPosition {
  offsetX: number
  clientX: number
  clientY: number
}

export function useRangeSelect(
  ref: React.RefObject<HTMLDivElement>,
  model: LGV,
  shiftOnly?: boolean,
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
        // as stated above, store both clientX/Y and offsetX for different
        // purposes
        setAnchorPosition({
          offsetX,
          clientX,
          clientY,
        })
        const args = computeOffsets(offsetX)
        if (args) {
          model.setOffsets(args.leftOffset, args.rightOffset)
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
  }, [startX, mouseDragging, anchorPosition, model, ref])

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
    model.setOffsets(undefined, undefined)
  }

  function handleClose() {
    setAnchorPosition(undefined)
    setStartX(undefined)
    setCurrentX(undefined)
  }

  function handleMenuItemClick(_: unknown, callback: Function) {
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
  } else {
    const right = anchorPosition ? anchorPosition.offsetX : currentX || 0
    const left = right < startX ? right : startX
    const width = Math.abs(right - startX)
    const leftBpOffset = model.pxToBp(left)
    const rightBpOffset = model.pxToBp(left + width)
    const numOfBpSelected = Math.ceil(width * model.bpPerPx)

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
}

export function useWheelScroll(
  ref: React.RefObject<HTMLDivElement>,
  model: {
    bpPerPx: number
    zoomTo: (arg: number, arg2?: number) => void
    setScaleFactor: (arg: number) => void
    horizontalScroll: (arg: number) => void
  },
) {
  const delta = useRef(0)
  const timeout = useRef<Timer>()
  const scheduled = useRef(false)
  useEffect(() => {
    const curr = ref.current

    // if ctrl is held down, zoom in with y-scroll
    // else scroll horizontally with x-scroll
    function onWheel(origEvent: WheelEvent) {
      const event = normalizeWheel(origEvent)
      if (origEvent.ctrlKey === true) {
        origEvent.preventDefault()
        delta.current += event.pixelY / 500
        model.setScaleFactor(
          delta.current < 0 ? 1 - delta.current : 1 / (1 + delta.current),
        )
        if (timeout.current) {
          clearTimeout(timeout.current)
        }
        timeout.current = setTimeout(() => {
          model.setScaleFactor(1)
          model.zoomTo(
            delta.current > 0
              ? model.bpPerPx * (1 + delta.current)
              : model.bpPerPx / (1 - delta.current),
            origEvent.clientX - (curr?.getBoundingClientRect().left || 0),
          )
          delta.current = 0
        }, 300)
      } else {
        // this is needed to stop the event from triggering "back button
        // action" on MacOSX etc.  but is a heuristic to avoid preventing the
        // inner-track scroll behavior
        if (Math.abs(event.pixelX) > Math.abs(2 * event.pixelY)) {
          origEvent.preventDefault()
        }
        delta.current += event.pixelX
        if (!scheduled.current) {
          // use rAF to make it so multiple event handlers aren't fired per-frame
          // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
          scheduled.current = true
          window.requestAnimationFrame(() => {
            model.horizontalScroll(delta.current)
            delta.current = 0
            scheduled.current = false
          })
        }
      }
    }
    if (curr) {
      curr.addEventListener('wheel', onWheel)
      return () => {
        curr.removeEventListener('wheel', onWheel)
      }
    }
    return () => {}
  }, [model, ref])
}
