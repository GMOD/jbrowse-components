import { useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { MultiVariantBaseModel } from '../../shared/MultiVariantBaseModel'

const MultiLinearVariantMatrixRendering = observer(function (props: {
  width: number
  height: number
  displayModel: MultiVariantBaseModel
  arr: string[][]
}) {
  const { arr, width, height, displayModel } = props
  const ref = useRef<HTMLDivElement>(null)

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    if (!ref.current) {
      return
    }
    const r = ref.current.getBoundingClientRect()
    const offsetX = eventClientX - r.left
    const offsetY = eventClientY - r.top

    const dimY = arr.length
    const dimX = arr[0]?.length || 0
    const name =
      displayModel.sources![Math.floor((offsetY / height) * dimX)]?.name
    const genotype =
      arr[Math.floor((offsetX / width) * dimY)]?.[
        Math.floor((offsetY / height) * dimX)
      ]
    return genotype && name
      ? {
          name,
          genotype,
        }
      : undefined
  }
  return (
    <div
      ref={ref}
      onMouseMove={e => {
        displayModel.setHoveredGenotype(
          getFeatureUnderMouse(e.clientX, e.clientY),
        )
      }}
      onMouseLeave={() => {
        displayModel.setHoveredGenotype(undefined)
      }}
      onMouseOut={() => {
        displayModel.setHoveredGenotype(undefined)
      }}
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
})

export default MultiLinearVariantMatrixRendering
