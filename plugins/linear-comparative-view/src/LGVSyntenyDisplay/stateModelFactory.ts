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
import { types } from 'mobx-state-tree'
import { when } from 'mobx'

const { parseCigar } = MismatchParser

function findPosInCigarString(
  cigar: string[],
  x: number,
  featStart: number,
  mateStart: number,
) {
  let featX = 0
  let mateX = 0
  for (let i = 0; i < cigar.length; i += 2) {
    const len = +cigar[i]
    const op = cigar[i + 1]
    const coord = featStart + featX
    const min = Math.min(len, x - coord)

    if (coord >= x) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function navToSynteny(feature: Feature, self: any) {
  const session = getSession(self)
  const track = getContainingTrack(self)
  const view = getContainingView(self)
  const reg = view.dynamicBlocks.contentBlocks[0]
  const cigar = parseCigar(feature.get('cg') || '')
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

  let rMateStart = mateStart
  let rMateEnd = mateStart
  let rFeatStart = featStart
  let rFeatEnd = featStart

  if (cigar.length) {
    const [featStartX, mateStartX] = findPosInCigarString(
      cigar,
      regStart,
      featStart,
      mateStart,
    )
    const [featEndX, mateEndX] = findPosInCigarString(
      cigar,
      regEnd,
      featStart,
      mateStart,
    )

    if (strand === -1) {
      rFeatStart = featStart + featStartX
      rFeatEnd = featStart + featEndX
      rMateStart = mateEnd - mateEndX
      rMateEnd = mateEnd - mateStartX
    } else {
      rFeatStart = featStart + featStartX
      rFeatEnd = featStart + featEndX
      rMateStart = mateStart + mateStartX
      rMateEnd = mateStart + mateEndX
    }
  } else {
    rFeatEnd = featEnd
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
  })
  const f = (n: number) => Math.floor(n)
  const l1 = `${featRef}:${f(rFeatStart)}-${f(rFeatEnd)}`
  const l2 = `${mateRef}:${f(rMateStart)}-${f(rMateEnd)}`
  await when(() => view2.width !== undefined)
  // @ts-ignore
  view2.views[0].navToLocString(l1, featAsm)
  // @ts-ignore
  view2.views[1].navToLocString(l2, mateAsm)
}

/**
 * #stateModel LGVSyntenyDisplay
 * extends `LinearBasicDisplay`, displays location of "synteny" feature in a
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
}

export default stateModelFactory
