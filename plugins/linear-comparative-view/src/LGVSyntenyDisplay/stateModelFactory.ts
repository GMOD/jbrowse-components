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

const { parseCigar } = MismatchParser

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function navToSynteny(feature: Feature, self: any) {
  const session = getSession(self)
  const track = getContainingTrack(self)
  const view = getContainingView(self)
  const reg = view.dynamicBlocks.contentBlocks[0]
  const cigar = parseCigar(feature.get('cg') || '')
  const regStart = reg.start
  const regEnd = reg.end
  const featStart = feature.get('start')
  const mate = feature.get('mate')
  const mateStart = mate.start
  const mateAsm = mate.assemblyName
  const mateRef = mate.refName
  const featAsm = reg.assemblyName
  const featRef = reg.refName

  let rMateStart = mateStart
  let rMateEnd = mateStart
  let rFeatStart = featStart
  let rFeatEnd = featStart

  for (let i = 0; i < cigar.length && rFeatStart < regStart; i += 2) {
    const len = +cigar[i]
    const op = cigar[i + 1]
    if (op === 'I') {
      rMateStart += len
    } else if (op === 'D') {
      rFeatStart += len
    } else if (op === 'M') {
      const l2 = Math.min(len, regStart - rFeatStart)

      rMateStart += l2
      rFeatStart += l2
    }
  }
  for (let i = 0; i < cigar.length && rFeatEnd < regEnd; i += 2) {
    const len = +cigar[i]
    const op = cigar[i + 1]
    if (op === 'I') {
      rMateEnd += len
    } else if (op === 'D') {
      rFeatEnd += len
    } else if (op === 'M') {
      const l2 = Math.min(len, regEnd - rFeatEnd)
      rMateEnd += l2
      rFeatEnd += l2
    }
  }
  const trackId = track.configuration.trackId

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
  })
  const f = (n: number) => Math.floor(n)
  const l1 = `${featRef}:${f(rFeatStart)}-${f(rFeatEnd)}`
  const l2 = `${mateRef}:${f(rMateStart)}-${f(rMateEnd)}`
  // @ts-ignore
  view2.views[0].navToLocString(l1, featAsm)
  // @ts-ignore
  view2.views[1].navToLocString(l2, mateAsm)
}

/**
 * #stateModel LGVSyntenyDisplay
 * extends `LinearBasicDisplay`, displays location of "synteny" featur in a
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
