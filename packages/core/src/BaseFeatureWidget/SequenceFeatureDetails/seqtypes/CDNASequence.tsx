import { observer } from 'mobx-react'

import SequenceLegend from '../SequenceLegend.tsx'
import { cdsColor, updownstreamColor, utrColor } from '../consts.ts'
import {
  computeCoordProps,
  getIntronDisplayStr,
  splitRegionByCds,
  transcriptRegions,
} from '../util.ts'
import {
  flankSegment,
  renderSequenceSegments,
} from './renderSequenceSegments.tsx'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { Feat } from '../../util.tsx'
import type { SequenceFeatureDetailsModel } from '../model.ts'
import type { SeqSegment } from './renderSequenceSegments.tsx'

const CDNASequence = observer(function CDNASequence({
  cds,
  exons,
  sequence,
  upstream,
  downstream,
  feature,
  includeIntrons,
  collapseIntron,
  useGenomicCoords,
  revcomp,
  onHoverBase,
  model,
}: {
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
  // the sequence itself is already flipped upstream of here; the flag only
  // tells the coordinate labels which direction they now run
  revcomp: boolean
  onHoverBase?: (base0: number) => void
  model: SequenceFeatureDetailsModel
}) {
  const { upperCaseCDS, intronBp } = model
  const hasCds = cds.length > 0
  // upperCaseCDS capitalizes the coding sequence and lowercases everything
  // else; otherwise every stretch keeps the reference genome's own casing
  const caseCoding = (s: string) => (upperCaseCDS ? s.toUpperCase() : s)
  const caseNoncoding = (s: string) => (upperCaseCDS ? s.toLowerCase() : s)

  const { mult, coordStart } = computeCoordProps({
    feature,
    useGenomicCoords,
    upstream,
    revcomp,
  })

  // the transcript is its exons; the CDS only decides how each stretch is
  // colored and cased. Deriving that split here, rather than stitching a
  // separately-supplied UTR list, keeps the rendered sequence complete however
  // the annotation expresses its UTRs -- or whether it expresses them at all.
  const regions = transcriptRegions({
    cds,
    exons,
    featureLength: sequence.length,
  }).filter(f => f.start !== f.end)

  const middle: SeqSegment[] = []
  for (let idx = 0; idx < regions.length; idx++) {
    const region = regions[idx]!
    for (const { start, end, isCds } of splitRegionByCds(region, cds)) {
      const s = sequence.slice(start, end)
      middle.push({
        key: `${start}-${end}-${isCds ? 'cds' : 'utr'}`,
        // uppercase CDS (and every region of a noncoding transcript); lower UTR
        str: isCds || !hasCds ? caseCoding(s) : caseNoncoding(s),
        color: isCds ? cdsColor : utrColor,
      })
    }

    const next = regions[idx + 1]
    if (includeIntrons && next) {
      const intron = sequence.slice(region.end, next.start)
      if (intron) {
        middle.push({
          key: `${region.start}-${region.end}-intron`,
          str: caseNoncoding(
            getIntronDisplayStr(intron, intronBp, collapseIntron ?? false),
          ),
        })
      }
    }
  }

  const segments = [
    ...flankSegment('upstream', upstream, updownstreamColor, caseNoncoding),
    ...middle,
    ...flankSegment('downstream', downstream, updownstreamColor, caseNoncoding),
  ]

  // keyed off the colors actually emitted, so the legend can never advertise a
  // swatch that is not on screen (e.g. a transcript with no UTR). Introns are
  // deliberately absent: they are the uncolored stretches, so there is no
  // swatch to explain. A lone swatch explains nothing, hence the >1.
  const usedColors = new Set(segments.map(seg => seg.color))
  const legendItems = [
    { color: cdsColor, label: 'CDS' },
    { color: utrColor, label: hasCds ? 'UTR' : 'exon' },
    { color: updownstreamColor, label: 'up/downstream' },
  ].filter(item => usedColors.has(item.color))

  return (
    <>
      {legendItems.length > 1 ? <SequenceLegend items={legendItems} /> : null}
      {renderSequenceSegments({
        model,
        mult,
        coordStart,
        onHoverBase: useGenomicCoords ? onHoverBase : undefined,
        segments,
      })}
    </>
  )
})

export default CDNASequence
