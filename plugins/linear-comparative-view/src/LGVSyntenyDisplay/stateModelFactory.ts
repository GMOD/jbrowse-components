import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import {
  MismatchParser,
  linearPileupDisplayStateModelFactory,
} from '@jbrowse/plugin-alignments'
import { types } from 'mobx-state-tree'

const { parseCigar } = MismatchParser

/**
 * #stateModel LGVSyntenyDisplay
 * extends `LinearBasicDisplay`, displays location of "synteny" features in a
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
                    label: 'Test',
                    onClick: () => {
                      const view = getContainingView(self)
                      const r0 = view.dynamicBlocks.contentBlocks[0]
                      const cigar = parseCigar(feature.get('cg') || '')
                      const r0s = r0.start
                      const r0e = r0.end
                      const f0s = feature.get('start')
                      const f0e = feature.get('end')
                      const mate = feature.get('mate')
                      const m0s = mate.start
                      const m0e = mate.end

                      let p0 = m0s
                      let p1 = m0s

                      for (
                        let i = 0, t0 = f0s;
                        i < cigar.length && t0 < r0s;
                        i += 2
                      ) {
                        const len = +cigar[i]
                        const op = cigar[i + 1]
                        if (op === 'I') {
                          p0 += len
                        } else if (op === 'D') {
                          t0 += len
                        } else if (op === 'M') {
                          const l2 = Math.min(len, r0s - t0)
                          p0 += l2
                          t0 += l2
                        }
                      }
                      for (
                        let i = 0, t0 = f0s;
                        i < cigar.length && t0 < r0e;
                        i += 2
                      ) {
                        const len = +cigar[i]
                        const op = cigar[i + 1]
                        if (op === 'I') {
                          p1 += len
                        } else if (op === 'D') {
                          t0 += len
                        } else if (op === 'M') {
                          const l2 = Math.min(len, r0e - t0)
                          p1 += l2
                          t0 += l2
                        }
                      }
                      console.log({ p0, p1 })
                    },
                  },
                ]
              : []),
          ]
        },
      }
    })
}

export default stateModelFactory
