import { useMemo, useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import { minElt } from './util'
import { makeSimpleAltString } from '../../VcfFeature/util'

import type { Source } from '../../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

interface Item {
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
  flatbush: any
  items: Item[]
  displayModel: any
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, arg?: Feature) => void
  onFeatureClick?: (event: React.MouseEvent, arg?: Feature) => void
}) {
  const { flatbush, items, displayModel, featureGenotypeMap, totalHeight } =
    props
  const ref = useRef<HTMLDivElement>(null)
  const flatbush2 = useMemo(() => Flatbush.from(flatbush), [flatbush])

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    let offsetX = 0
    let offsetY = 0
    if (!ref.current) {
      return
    }
    const rect = ref.current.getBoundingClientRect()
    offsetX = eventClientX - rect.left
    offsetY = eventClientY - rect.top

    const x = flatbush2.search(offsetX, offsetY, offsetX + 1, offsetY + 1)
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
          top: 0,
        }}
      />
    </div>
  )
})

export default MultiVariantRendering
