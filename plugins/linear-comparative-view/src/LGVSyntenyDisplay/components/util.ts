import { parseCigar2 } from '@jbrowse/plugin-alignments'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_X,
} from '@jbrowse/alignments-core'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

type LSV = LinearSyntenyViewModel

function findPosInCigar(cigar: number[], startX: number) {
  let featX = 0
  let mateX = 0
  for (const packed of cigar) {
    if (featX >= startX) {
      break
    }
    const len = packed >>> 4
    const opIdx = packed & 0xf
    const min = Math.min(len, startX - featX)
    if (opIdx === CIGAR_I) {
      mateX += len
    } else if (opIdx === CIGAR_D) {
      featX += min
    } else if (opIdx === CIGAR_M || opIdx === CIGAR_EQ || opIdx === CIGAR_X) {
      mateX += min
      featX += min
    }
  }
  return [featX, mateX] as const
}

interface SimpleRegion {
  refName: string
  start: number
  end: number
}

export async function navToSynteny({
  feature,
  windowSize: ws,
  session,
  trackId,
  region,
  horizontallyFlip,
}: {
  windowSize: number
  trackId: string
  horizontallyFlip: boolean
  feature: Feature
  session: AbstractSessionModel
  region?: SimpleRegion
}) {
  const cigar = feature.get('CIGAR')
  const strand = feature.get('strand')

  const featRef = feature.get('refName')
  const featAsm = feature.get('assemblyName')
  const featStart = feature.get('start')
  const featEnd = feature.get('end')
  const mate = feature.get('mate')
  const mateStart = mate.start
  const mateEnd = mate.end
  const mateAsm = mate.assemblyName
  const mateRef = mate.refName

  let rMateStart: number
  let rMateEnd: number
  let rFeatStart: number
  let rFeatEnd: number

  if (region && cigar) {
    const regStart = region.start
    const regEnd = region.end
    const p = parseCigar2(cigar)
    const [fStartX, mStartX] = findPosInCigar(p, regStart - featStart)
    const [fEndX, mEndX] = findPosInCigar(p, regEnd - featStart)

    // avoid multiply by 0 with strand undefined
    const flipper = strand === -1 ? -1 : 1
    rFeatStart = featStart + fStartX
    rFeatEnd = featStart + fEndX
    rMateStart = (strand === -1 ? mateEnd : mateStart) + mStartX * flipper
    rMateEnd = (strand === -1 ? mateEnd : mateStart) + mEndX * flipper
  } else {
    rFeatStart = featStart
    rFeatEnd = featEnd
    rMateStart = mateStart
    rMateEnd = mateEnd
  }
  const l1 = `${featRef}:${Math.floor(rFeatStart - ws)}-${Math.floor(rFeatEnd + ws)}`
  const m1 = Math.min(rMateStart, rMateEnd)
  const m2 = Math.max(rMateStart, rMateEnd)
  const l2 = `${mateRef}:${Math.floor(m1 - ws)}-${Math.floor(m2 + ws)}${
    horizontallyFlip ? '[rev]' : ''
  }`
  session.addView('LinearSyntenyView', {
    type: 'LinearSyntenyView',
    views: [
      {
        type: 'LinearGenomeView',
        hideHeader: true,
        init: {
          assembly: featAsm,
          loc: l1,
        },
      },
      {
        type: 'LinearGenomeView',
        hideHeader: true,
        init: {
          assembly: mateAsm,
          loc: l2,
        },
      },
    ],
    tracks: [
      {
        configuration: trackId,
        type: 'SyntenyTrack',
        displays: [
          {
            type: 'LinearSyntenyDisplay',
            configuration: `${trackId}-LinearSyntenyDisplay`,
          },
        ],
      },
    ],
  }) as LSV
}
