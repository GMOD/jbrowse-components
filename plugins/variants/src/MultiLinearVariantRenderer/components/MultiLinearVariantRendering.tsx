import { useMemo, useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import RBush from 'rbush'

import { minElt } from './util'
import { makeSimpleAltString } from '../../VcfFeature/util'

import type { Source } from '../../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

interface RBushData {
  minX: number
  maxX: number
  minY: number
  maxY: number
  genotype: string
  featureId: string
}

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
  rbush: SerializedRBush
  displayModel: any
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, arg?: Feature) => void
  onFeatureClick?: (event: React.MouseEvent, arg?: Feature) => void
}) {
  const { rbush, displayModel, featureGenotypeMap, totalHeight, scrollTop } =
    props
  const ref = useRef<HTMLDivElement>(null)
  const rbush2 = useMemo(() => new RBush<RBushData>().fromJSON(rbush), [rbush])

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    let offsetX = 0
    let offsetY = 0
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      offsetX = eventClientX - r.left
      offsetY = eventClientY - r.top - (displayModel?.scrollTop || 0)
    }

    const x = rbush2.search({
      minX: offsetX,
      maxX: offsetX + 1,
      minY: offsetY,
      maxY: offsetY + 1,
    })
    if (x.length) {
      const { minX, minY, maxX, maxY, genotype, featureId, ...rest } = minElt(
        x,
        elt => elt.maxX - elt.minX,
      )!
      const ret = featureGenotypeMap[featureId]
      if (ret) {
        const { ref, alt, name, description, length } = ret
        const alleles = makeSimpleAltString(genotype, ref, alt)
        return {
          ...rest,
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
