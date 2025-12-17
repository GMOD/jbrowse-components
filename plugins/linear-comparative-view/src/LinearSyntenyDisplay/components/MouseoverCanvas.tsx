import { useCallback, useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { drawMouseoverClickMap } from '../drawSynteny'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import type { LinearSyntenyDisplayModel } from '../model'

const MouseoverCanvas = observer(function ({
  model,
  width,
  height,
  className,
}: {
  model: LinearSyntenyDisplayModel
  width: number
  height: number
  className: string
}) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const { mouseoverId, clickId, featPositions } = model
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const mouseoverCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMouseoverCanvasRef(ref)
    },
    [model],
  )

  const offsetsKey = JSON.stringify(view.views.map(v => v.offsetPx))

  // Debounced effect for offset changes (during scroll)
  useEffect(() => {
    if (!model.mouseoverCanvas || featPositions.length === 0) {
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      drawMouseoverClickMap(model)
    }, 100)
    return () => {
      clearTimeout(debounceRef.current)
    }
  }, [model, featPositions.length, offsetsKey])

  // Immediate effect for mouseover/click changes (user interaction)
  useEffect(() => {
    if (!model.mouseoverCanvas || featPositions.length === 0) {
      return
    }
    drawMouseoverClickMap(model)
  }, [model, mouseoverId, clickId, featPositions.length])

  return (
    <canvas
      ref={mouseoverCanvasRef}
      width={width}
      height={height}
      className={className}
    />
  )
})

export default MouseoverCanvas
