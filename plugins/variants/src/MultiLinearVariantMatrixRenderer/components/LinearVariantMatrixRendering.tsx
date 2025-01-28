import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import RBush from 'rbush'
import { useMemo, useRef } from 'react'

const LinearVariantMatrixRendering = observer(function (props: {
  width: number
  height: number
  rbush: any
  displayModel: any
  arr: string[]
}) {
  const { arr, width, height, displayModel, rbush } = props
  //const clickMap2 = useMemo(
  //  () => new RBush<{ genotype: string }>().fromJSON(rbush),
  //  [rbush],
  //)
  const ref = useRef<HTMLDivElement>(null)
  console.log({ arr })

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    // calculates feature under mouse
    let offsetX = 0
    let offsetY = 0
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      offsetX = eventClientX - r.left
      offsetY = eventClientY - r.top
    }

    const dimY = arr.length
    const dimX = arr[0]?.length || 0
    //console.log(arr, {
    //  w: Math.round((offsetX / width) * dimY),
    //  h: Math.round((offsetY / height) * dimX),
    //  dimX,
    //  dimY,
    //})
    return arr[Math.floor((offsetX / width) * dimY)]?.[
      Math.floor((offsetY / height) * dimX)
    ]
  }
  return (
    <div
      ref={ref}
      onMouseMove={e =>
        displayModel.setHoveredGenotype?.(
          getFeatureUnderMouse(e.clientX, e.clientY),
        )
      }
      onMouseLeave={() => {
        displayModel.setHoveredGenotype?.(undefined)
      }}
      onMouseOut={() => {
        displayModel.setHoveredGenotype?.(undefined)
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

export default LinearVariantMatrixRendering
