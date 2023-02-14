import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import {
  getSession,
  getContainingTrack,
  getContainingView,
  Feature,
} from '@jbrowse/core/util'
import {
  MismatchParser,
  linearPileupDisplayStateModelFactory,
} from '@jbrowse/plugin-alignments'
import { IAnyStateTreeNode, types } from 'mobx-state-tree'
import { when } from 'mobx'

// locals
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

type LSV = LinearSyntenyViewModel

const { parseCigar } = MismatchParser

function findPosInCigar(cigar: string[], startX: number) {
  let featX = 0
  let mateX = 0
  for (let i = 0; i < cigar.length; i++) {
    const len = +cigar[i]
    const op = cigar[i + 1]
    const min = Math.min(len, startX - featX)

    if (featX >= startX) {
      break
    } else if (op === 'I') {
      mateX += len
    } else if (op === 'D') {
      featX += min
    } else if (op === 'M') {
      mateX += min
      featX += min
    }
  }
  return [featX, mateX]
}

async function navToSynteny(feature: Feature, self: IAnyStateTreeNode) {
  const session = getSession(self)
  const track = getContainingTrack(self)
  const view = getContainingView(self)
  const reg = view.dynamicBlocks.contentBlocks[0]
  const cigar = feature.get('CIGAR')
  const strand = feature.get('strand')
  const regStart = reg.start
  const regEnd = reg.end
  const featStart = feature.get('start')
  const featEnd = feature.get('end')
  const mate = feature.get('mate')
  const mateStart = mate.start
  const mateEnd = mate.end
  const mateAsm = mate.assemblyName
  const mateRef = mate.refName
  const featAsm = reg.assemblyName
  const featRef = reg.refName

  let rMateStart: number
  let rMateEnd: number
  let rFeatStart: number
  let rFeatEnd: number

  if (cigar) {
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
  const trackId = track.configuration.trackId

  const view2 = session.addView('LinearSyntenyView', {
    type: 'LinearSyntenyView',
    views: [
      {
        id: `${Math.random()}`,
        type: 'LinearGenomeView',
        hideHeader: true,
      },
      {
        id: `${Math.random()}`,
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
  const f = (n: number) => Math.floor(n)
  const l1 = `${featRef}:${f(rFeatStart)}-${f(rFeatEnd)}`
  const m1 = Math.min(rMateStart, rMateEnd)
  const m2 = Math.max(rMateStart, rMateEnd)
  const l2 = `${mateRef}:${f(m1)}-${f(m2)}${strand === -1 ? '[rev]' : ''}`
  await when(() => view2.width !== undefined)
  await Promise.all([
    view2.views[0].navToLocString(l1, featAsm),
    view2.views[1].navToLocString(l2, mateAsm),
  ])
}

/**
 * #stateModel LGVSyntenyDisplay
 * extends `LinearPileupDisplay`, displays location of "synteny" feature in a
 * plain LGV, allowing linking out to external synteny views
 */
function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LGVSyntenyDisplay',
      linearPileupDisplayStateModelFactory(schema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LGVSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(schema),
      }),
    )
    .views(self => {
      const superContextMenuItems = self.contextMenuItems
      return {
        contextMenuItems() {
          const feature = self.contextMenuFeature
          return [
            ...superContextMenuItems(),
            ...(feature
              ? [
                  {
                    label: 'Open synteny view for this position',
                    onClick: () => navToSynteny(feature, self),
                  },
                ]
              : []),
          ]
        },
      }
    })
    .actions(self => ({
      afterCreate() {
        // use color by strand to help indicate inversions better
        self.setColorScheme({ type: 'strand' })
      },
    }))
}

export default stateModelFactory
