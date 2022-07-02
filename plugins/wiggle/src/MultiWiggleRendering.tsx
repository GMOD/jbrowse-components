import React, { useRef } from 'react'
import { observer } from 'mobx-react'
import { Region } from '@jbrowse/core/util/types'
import { PrerenderedCanvas } from '@jbrowse/core/ui'

function WiggleRendering(props: {
  regions: Region[]
  bpPerPx: number
  width: number
  height: number
  onMouseLeave: Function
  onMouseMove: Function
  blockKey: string
}) {
  const {
    regions,
    bpPerPx,
    width,
    height,
    onMouseLeave = () => {},
    onMouseMove = () => {},
  } = props

  const [region] = regions
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      data-testid="wiggle-rendering-test"
      onMouseMove={event => {
        if (!ref.current) {
          return
        }
        const rect = ref.current.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientX - rect.top
        const px = region.reversed ? width - offsetX : offsetX
        const coord = Math.floor(region.start + bpPerPx * px)
        onMouseMove({ ...region, coord })
      }}
      onMouseLeave={() => onMouseLeave()}
      style={{ height }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
}

export default observer(WiggleRendering)
