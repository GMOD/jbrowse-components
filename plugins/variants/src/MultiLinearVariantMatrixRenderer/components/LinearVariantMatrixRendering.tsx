import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import RBush from 'rbush'
import { useMemo, useRef } from 'react'

const LinearVariantMatrixRendering = observer(function (props: {
  width: number
  height: number
  rbush: any
  displayModel: any
}) {
  const { height, displayModel, rbush } = props
  const clickMap2 = useMemo(
    () => new RBush<{ genotype: string }>().fromJSON(rbush),
    [rbush],
  )
  const ref = useRef<HTMLDivElement>(null)

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    // calculates feature under mouse
    let offsetX = 0
    let offsetY = 0
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      offsetX = eventClientX - r.left
      offsetY = eventClientY - r.top
    }
    const ret = clickMap2.search({
      minX: offsetX,
      minY: offsetY,
      maxX: offsetX + 3,
      maxY: offsetY + 3,
    })
    return ret[0]?.genotype
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
