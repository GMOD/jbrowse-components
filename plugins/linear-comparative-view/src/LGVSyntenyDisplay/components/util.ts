import { getSession } from '@jbrowse/core/util'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

// locals

type LSV = LinearSyntenyViewModel

const { parseCigar } = MismatchParser

function f(n: number) {
  return Math.floor(n)
}
function findPosInCigar(cigar: string[], startX: number) {
  let featX = 0
  let mateX = 0
  for (let i = 0; i < cigar.length; i++) {
    const len = +cigar[i]!
    const op = cigar[i + 1]!
    const min = Math.min(len, startX - featX)

    if (featX >= startX) {
      break
    }
    if (op === 'I') {
      mateX += len
    } else if (op === 'D') {
      featX += min
    } else if (op === 'M' || op === '=' || op === 'X') {
      mateX += min
      featX += min
    }
  }
  return [featX, mateX] as const
}

export async function navToSynteny({
  feature,
  windowSize: ws,
  model,
  trackId,
  view,
  horizontallyFlip,
}: {
  windowSize: number
  trackId: string
  horizontallyFlip: boolean
  feature: Feature
  view?: LinearGenomeViewModel
  model: IAnyStateTreeNode
}) {
  const session = getSession(model)
  const reg = view?.dynamicBlocks.contentBlocks[0]
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

  if (reg && cigar) {
    const regStart = reg.start
    const regEnd = reg.end
    const p = parseCigar(cigar)
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

  const view2 = session.addView('LinearSyntenyView', {
    type: 'LinearSyntenyView',
    views: [
      {
        type: 'LinearGenomeView',
        hideHeader: true,
      },
      {
        type: 'LinearGenomeView',
        hideHeader: true,
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
  const l1 = `${featRef}:${f(rFeatStart - ws)}-${f(rFeatEnd + ws)}`
  const m1 = Math.min(rMateStart, rMateEnd)
  const m2 = Math.max(rMateStart, rMateEnd)
  const l2 = `${mateRef}:${f(m1 - ws)}-${f(m2 + ws)}${
    horizontallyFlip ? '[rev]' : ''
  }`
  await Promise.all([
    view2.views[0]!.navToLocString(l1, featAsm),
    view2.views[1]!.navToLocString(l2, mateAsm),
  ])
}
