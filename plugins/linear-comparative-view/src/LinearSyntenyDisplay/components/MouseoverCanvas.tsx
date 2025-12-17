import { useCallback } from 'react'

import { observer } from 'mobx-react'

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
  const mouseoverCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMouseoverCanvasRef(ref)
    },
    [model],
  )

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
