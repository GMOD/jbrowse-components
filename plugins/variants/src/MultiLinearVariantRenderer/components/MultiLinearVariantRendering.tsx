import { useMemo, useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import Flatbush from 'flatbush'
import { observer } from 'mobx-react'

import { minElt } from './util'
import { makeSimpleAltString } from '../../VcfFeature/util'

import type { Source } from '../../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import { FlatbushItem } from '../makeImageData'

type SerializedRBush = any

interface MinimizedVariantRecord {
  alt: string[]
  ref: string
  name: string
  description: string
  length: number
}

const MultiVariantRendering = observer(function (props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  sources: Source[]
  scrollTop: number
  featureGenotypeMap: Record<string, MinimizedVariantRecord>
  totalHeight: number
  flatbush: {
    index: any
    items: FlatbushItem[]
  }
  displayModel: any
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, arg?: Feature) => void
  onFeatureClick?: (event: React.MouseEvent, arg?: Feature) => void
}) {
  const { flatbush, displayModel, featureGenotypeMap, totalHeight, scrollTop } =
    props
  const { index, items } = flatbush
  const ref = useRef<HTMLDivElement>(null)
  const rbush2 = useMemo(() => Flatbush.from(index), [index])
  console.log({ items, index })

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    let offsetX = 0
    let offsetY = 0
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      offsetX = eventClientX - r.left
      offsetY = eventClientY - r.top - (displayModel?.scrollTop || 0)
    }

    const results = rbush2.search(offsetX, offsetX + 1, offsetY, offsetY + 1)
    console.log({ results })
    if (results.length) {
      const r0 = minElt(
        results.map(resultIndex => items[resultIndex]!),
        elt => elt.w,
      )
      console.log({ r0 })

      if (r0 !== undefined) {
        const { featureId, genotype } = r0
        const ret =
          featureId !== undefined ? featureGenotypeMap[featureId] : undefined
        console.log({ ret })
        if (ret) {
          const { ref, alt, name, description, length } = ret
          const alleles = makeSimpleAltString(genotype, ref, alt)
          return {
            genotype,

            // alleles is a expanded description, e.g. if genotype is 1/0,
            // alleles is T/C
            alleles,
            featureName: name,

            // avoid rendering multiple alt alleles as description, particularly
            // with Cactus VCF where a large SV has many different ALT alleles.
            // since descriptions are a join of ALT allele descriptions, just
            // skip this in this case
            description: alt.length >= 3 ? 'multiple ALT alleles' : description,
            length: getBpDisplayStr(length),
          }
        }
      }
    }
    return undefined
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
        height: totalHeight,
      }}
    >
      <PrerenderedCanvas
        {...props}
        style={{
          position: 'absolute',
          left: 0,
          top: scrollTop,
        }}
      />
    </div>
  )
})

export default MultiVariantRendering
