import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItem,
  getSortByMenuItem,
  linearAlignmentsDisplayStateModelFactory,
  pickColorOptions,
} from '@jbrowse/plugin-alignments'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import {
  canLaunchSyntenyForMate,
  findVisibleBlockForFeature,
  getMate,
} from './components/util.ts'
import { getSyntenyGroupByMenuItem, getSyntenyShowMenuItem } from './menus.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LaunchSyntenyViewDialog = lazy(
  () => import('./components/LaunchSyntenyViewDialog.tsx'),
)

/**
 * #stateModel LGVSyntenyDisplay
 * displays location of "synteny" feature in a plain LGV, allowing linking out
 * to external synteny views
 *
 * #example
 * Shows a `SyntenyTrack`'s alignments in a plain linear view (rather than the
 * two-row synteny view). Same track config as a synteny track — just pick this
 * display type:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'hg38_vs_mm10',
 *   name: 'hg38 vs mm10',
 *   assemblyNames: ['hg38', 'mm10'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/hg38_vs_mm10.paf',
 *     queryAssembly: 'hg38',
 *     targetAssembly: 'mm10',
 *   },
 *   displays: [
 *     {
 *       type: 'LGVSyntenyDisplay',
 *       displayId: 'hg38_vs_mm10-LGVSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 */
function stateModelFactory(schema: AnyConfigurationSchemaType) {
  const baseModel = linearAlignmentsDisplayStateModelFactory(schema)
  return (
    types
      .compose(
        'LGVSyntenyDisplay',
        baseModel,
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
      // showCoverage defaults to false for synteny via the config-slot override
      // in configSchemaF (the base alignments display defaults it to true).
      .views(() => ({
        /**
         * #getter
         * synteny features open the SyntenyFeatureWidget; the inherited
         * `selectFeature` action reads this getter, so no override is needed.
         */
        get featureWidgetType() {
          return {
            type: 'SyntenyFeatureWidget',
            id: 'syntenyFeature',
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        contextMenuItems() {
          const feature = self.contextMenuFeature
          const mateAssembly = feature
            ? getMate(feature).assemblyName
            : undefined
          const canLaunchSynteny = canLaunchSyntenyForMate(
            getConf(getContainingTrack(self), 'assemblyNames'),
            mateAssembly,
          )
          return feature
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: () => {
                    self.selectFeature(feature)
                  },
                },
                ...(canLaunchSynteny
                  ? [
                      {
                        label: 'Launch synteny view for this position',
                        onClick: () => {
                          getSession(self).queueDialog(handleClose => [
                            LaunchSyntenyViewDialog,
                            {
                              visibleRegion: findVisibleBlockForFeature(
                                getContainingView(
                                  self,
                                ) as LinearGenomeViewModel,
                                feature,
                              ),
                              trackId: getConf(
                                getContainingTrack(self),
                                'trackId',
                              ),
                              handleClose,
                              session: getSession(self),
                              feature,
                            },
                          ])
                        },
                      },
                    ]
                  : []),
                {
                  label: 'Copy info to clipboard',
                  icon: ContentCopyIcon,
                  onClick: async () => {
                    const session = getSession(self)
                    try {
                      const { uniqueId: _uniqueId, ...rest } = feature.toJSON()
                      const { default: copy } =
                        await import('@jbrowse/core/util/copyToClipboard')
                      copy(JSON.stringify(rest, null, 4))
                      session.notify('Copied to clipboard', 'success')
                    } catch (e) {
                      console.error(e)
                      session.notifyError(`${e}`, e)
                    }
                  },
                },
              ]
            : []
        },
        /**
         * #method
         */
        // Every entry is a submenu, in the same order as the alignments display's
        // track menu (color, sort, filter, group, show, height) — the two share a
        // state model and a component, so the menus should read the same way. The
        // per-setting curation (which color schemes, which sort modes, which
        // layers) is what makes this synteny's menu rather than a copy.
        trackMenuItems() {
          return [
            getColorByMenuItem(self, {
              colorOptions: pickColorOptions(
                'normal',
                'strand',
                'mappingQuality',
              ),
            }),
            // No base pair / tag: a PAF block has no per-base sequence to sort a
            // column by, and no SAM tags. 'Longest features first' is the
            // largeFeaturesFirst layout flag, folded in as a peer radio because
            // it competes with a real sort for the same ordering.
            getSortByMenuItem(self, {
              noun: 'feature',
              modes: ['position', 'length', 'strand'],
            }),
            getFiltersMenuItem(self),
            getSyntenyGroupByMenuItem(self),
            getSyntenyShowMenuItem(self),
            getFeatureHeightMenuItem(self, 'feature'),
          ] satisfies MenuItem[]
        },
      }))
  )
}

export default stateModelFactory
