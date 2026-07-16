import { observer } from 'mobx-react'

import { cdsColor, updownstreamColor, utrColor } from '../consts.ts'
import { computeCoordProps, getIntronDisplayStr } from '../util.ts'
import {
  flankSegment,
  renderSequenceSegments,
} from './renderSequenceSegments.tsx'

import type { SeqSegment } from './renderSequenceSegments.tsx'
import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { Feat } from '../../util.tsx'
import type { SequenceFeatureDetailsModel } from '../model.ts'

const CDNASequence = observer(function CDNASequence({
  utr,
  cds,
  exons,
  sequence,
  upstream,
  downstream,
  feature,
  includeIntrons,
  collapseIntron,
  useGenomicCoords,
  onHoverBase,
  model,
}: {
  utr: Feat[]
  cds: Feat[]
  exons: Feat[]
  sequence: string
  upstream?: string
  downstream?: string
  feature: SimpleFeatureSerialized
  includeIntrons?: boolean
  collapseIntron?: boolean
  // label rows (and report hovers) as genomic positions rather than offsets
  // from the feature start. Mapping display index to genome linearly only holds
  // when introns are shown uncollapsed, so the caller resolves this from the
  // mode rather than reading the setting directly.
  useGenomicCoords: boolean
  onHoverBase?: (base0: number) => void
  model: SequenceFeatureDetailsModel
}) {
  const { upperCaseCDS, intronBp } = model
  const hasCds = cds.length > 0
  const chunks = (
    hasCds ? [...cds, ...utr].sort((a, b) => a.start - b.start) : exons
  ).filter(f => f.start !== f.end)
  const toLower = (s: string) => (upperCaseCDS ? s.toLowerCase() : s)
  const toUpper = (s: string) => (upperCaseCDS ? s.toUpperCase() : s)

  const { mult, coordStart } = computeCoordProps(
    feature,
    useGenomicCoords,
    upstream,
  )

  const middle: SeqSegment[] = []
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]!
    const s = sequence.slice(chunk.start, chunk.end)
    const isCds = chunk.type === 'CDS'
    middle.push({
      key: `${chunk.start}-${chunk.end}-${chunk.type}-mid`,
      // uppercase CDS (and whole-exon chunks when there's no CDS); lowercase UTR
      str: isCds || !hasCds ? toUpper(s) : toLower(s),
      color: isCds ? cdsColor : utrColor,
    })

    const next = chunks[idx + 1]
    if (includeIntrons && next) {
      const intron = sequence.slice(chunk.end, next.start)
      if (intron) {
        middle.push({
          key: `${chunk.start}-${chunk.end}-${chunk.type}-intron`,
          str: toLower(
            getIntronDisplayStr(intron, intronBp, collapseIntron ?? false),
          ),
        })
      }
    }
  }

  return (
    <>
      {renderSequenceSegments({
        model,
        mult,
        coordStart,
        onHoverBase: useGenomicCoords ? onHoverBase : undefined,
        segments: [
          ...flankSegment('upstream', upstream, updownstreamColor, toLower),
          ...middle,
          ...flankSegment('downstream', downstream, updownstreamColor, toLower),
        ],
      })}
    </>
  )
})

export default CDNASequence
