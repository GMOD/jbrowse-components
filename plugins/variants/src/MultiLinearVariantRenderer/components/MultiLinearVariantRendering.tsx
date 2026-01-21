import { useCallback, useMemo, useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import { minElt } from './util.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'

import type { Source } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

interface Item {
  name: string
  genotype: string
  featureId: string
  bpLen: number
}

interface MinimizedVariantRecord {
  alt: string[]
  ref: string
  name: string
  description: string
  length: number
}

interface MultiVariantDisplayModel {
  setHoveredGenotype?: (genotype?: Record<string, unknown>) => void
}

interface RenderingProps {
  onFeatureClick?: (event: React.MouseEvent, featureId: string) => void
}

const MultiVariantRendering = observer(function MultiVariantRendering(props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  sources: Source[]
  origScrollTop: number
  featureGenotypeMap: Record<string, MinimizedVariantRecord>
  totalHeight: number
  flatbush: any
  items: Item[]
  displayModel: MultiVariantDisplayModel
  renderingProps?: RenderingProps
}) {
  const {
    flatbush,
    items,
    displayModel,
    featureGenotypeMap,
    totalHeight,
    origScrollTop,
    renderingProps,
  } = props
  const ref = useRef<HTMLDivElement>(null)
  const lastHoveredRef = useRef<string | undefined>(undefined)
  const flatbush2 = useMemo(() => Flatbush.from(flatbush), [flatbush])

  const getFeatureUnderMouse = useCallback(
    (eventClientX: number, eventClientY: number) => {
      if (!ref.current) {
        return
      }
      const rect = ref.current.getBoundingClientRect()
      const offsetX = eventClientX - rect.left
      const offsetY = eventClientY - rect.top

      // Canvas is positioned at top=origScrollTop, so adjust mouse position
      // relative to canvas top for Flatbush lookup
      const canvasOffsetY = offsetY - origScrollTop
      const x = flatbush2.search(
        offsetX,
        canvasOffsetY,
        offsetX + 1,
        canvasOffsetY + 1,
      )
      if (x.length) {
        const res = minElt(x, idx => items[idx]?.bpLen ?? 0)!
        const { bpLen, genotype, featureId, ...rest } = items[res] ?? {}
        const ret =
          featureId !== undefined ? featureGenotypeMap[featureId] : undefined
        if (ret && genotype) {
          const { ref, alt, name, description, length } = ret
          const alleles = makeSimpleAltString(genotype, ref, alt)
          return {
            ...rest,
            genotype,
            alleles,
            featureName: name,
            description: alt.length >= 3 ? 'multiple ALT alleles' : description,
            length: getBpDisplayStr(length),
          }
        }
      }
      return undefined
    },
    [flatbush2, items, featureGenotypeMap, origScrollTop],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const result = getFeatureUnderMouse(e.clientX, e.clientY)
      const key = result ? `${result.name}:${result.genotype}` : undefined
      if (key !== lastHoveredRef.current) {
        lastHoveredRef.current = key
        displayModel.setHoveredGenotype?.(result)
      }
    },
    [getFeatureUnderMouse, displayModel],
  )

  const handleMouseLeave = useCallback(() => {
    if (lastHoveredRef.current !== undefined) {
      lastHoveredRef.current = undefined
      displayModel.setHoveredGenotype?.(undefined)
    }
  }, [displayModel])

  const getFeatureIdUnderMouse = useCallback(
    (eventClientX: number, eventClientY: number) => {
      if (!ref.current) {
        return undefined
      }
      const rect = ref.current.getBoundingClientRect()
      const offsetX = eventClientX - rect.left
      const offsetY = eventClientY - rect.top
      const canvasOffsetY = offsetY - origScrollTop
      const x = flatbush2.search(
        offsetX,
        canvasOffsetY,
        offsetX + 1,
        canvasOffsetY + 1,
      )
      if (x.length) {
        const res = minElt(x, idx => items[idx]?.bpLen ?? 0)!
        return items[res]?.featureId
      }
      return undefined
    },
    [flatbush2, items, origScrollTop],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const featureId = getFeatureIdUnderMouse(e.clientX, e.clientY)
      if (featureId) {
        renderingProps?.onFeatureClick?.(e, featureId)
      }
    },
    [getFeatureIdUnderMouse, renderingProps],
  )

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseOut={handleMouseLeave}
      onClick={handleClick}
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
})

export default MultiVariantRendering
