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

const MultiLinearVariantMatrixRendering = observer(
  function MultiLinearVariantMatrixRendering(props: {
    width: number
    height: number
    displayModel: MultiVariantBaseModel
    arr: string[][]
    featureData: FeatureData[]
    rowHeight: number
    origScrollTop: number
    totalHeight: number
  }) {
    const {
      arr,
      width,
      displayModel,
      featureData,
      totalHeight,
      origScrollTop,
      rowHeight,
    } = props
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

        const { sources } = displayModel

        // Canvas is positioned at top=origScrollTop, so adjust mouse position
        // relative to canvas top
        const canvasOffsetY = offsetY - origScrollTop
        // The first row in the canvas corresponds to source at index startRow
        const startRow = Math.floor(origScrollTop / rowHeight)
        const visibleRowIdx = Math.floor(canvasOffsetY / rowHeight)
        const sourceIdx = startRow + visibleRowIdx
        const name = sources?.[sourceIdx]?.name
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
      [arr, width, displayModel, featureData, origScrollTop, rowHeight],
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
          height: totalHeight,
        }}
      >
        <PrerenderedCanvas
          {...props}
          style={{
            position: 'absolute',
            left: 0,
            top: origScrollTop,
          }}
        />
      </div>
    )
  },
)

export default MultiLinearVariantMatrixRendering
