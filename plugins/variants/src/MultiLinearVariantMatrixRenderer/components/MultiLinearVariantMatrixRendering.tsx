import { useCallback, useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { makeSimpleAltString } from '../../VcfFeature/util'

import type { MultiVariantBaseModel } from '../../shared/MultiVariantBaseModel'

interface FeatureData {
  alt: string[]
  ref: string
  name: string
  description: string
  length: number
}

const MultiLinearVariantMatrixRendering = observer(function (props: {
  width: number
  height: number
  displayModel: MultiVariantBaseModel
  arr: string[][]
  featureData: FeatureData[]
}) {
  const { arr, width, height, displayModel, featureData } = props
  const ref = useRef<HTMLDivElement>(null)
  const lastHoveredRef = useRef<string | undefined>(undefined)

  const getFeatureUnderMouse = useCallback(
    (eventClientX: number, eventClientY: number) => {
      if (!ref.current) {
        return
      }
      const r = ref.current.getBoundingClientRect()
      const offsetX = eventClientX - r.left
      const offsetY = eventClientY - r.top

      const { scrollTop, rowHeight, sources } = displayModel

      // Calculate actual source index accounting for scroll
      const sourceIdx = Math.floor((offsetY + scrollTop) / rowHeight)
      const name = sources?.[sourceIdx]?.name

      // For genotype lookup in arr (which only contains visible rows)
      const visibleRowIdx = Math.floor(offsetY / rowHeight)
      const featureIdx = Math.floor((offsetX / width) * arr.length)
      const genotype = arr[featureIdx]?.[visibleRowIdx]
      const feature = featureData[featureIdx]

      if (genotype && name && feature) {
        const { ref, alt, name: featureName, description, length } = feature
        const alleles = makeSimpleAltString(genotype, ref, alt)
        return {
          name,
          genotype,
          alleles,
          featureName,
          description: alt.length >= 3 ? 'multiple ALT alleles' : description,
          length: getBpDisplayStr(length),
        }
      }
      return undefined
    },
    [arr, width, displayModel, featureData],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const result = getFeatureUnderMouse(e.clientX, e.clientY)
      const key = result ? `${result.name}:${result.genotype}` : undefined
      if (key !== lastHoveredRef.current) {
        lastHoveredRef.current = key
        displayModel.setHoveredGenotype(result)
      }
    },
    [getFeatureUnderMouse, displayModel],
  )

  const handleMouseLeave = useCallback(() => {
    if (lastHoveredRef.current !== undefined) {
      lastHoveredRef.current = undefined
      displayModel.setHoveredGenotype(undefined)
    }
  }, [displayModel])
  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseOut={handleMouseLeave}
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
