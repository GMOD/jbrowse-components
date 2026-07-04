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
  linearAlignmentsDisplayStateModelFactory,
  pickColorOptions,
} from '@jbrowse/plugin-alignments'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { findVisibleBlockForFeature } from './components/util.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
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
          // one-vs-all can pair the feature with a sample that isn't a loaded
          // assembly; a synteny view can only be launched against a loaded one
          const mate = feature?.get('mate') as
            | { assemblyName?: string }
            | undefined
          const mateAssembly = mate?.assemblyName
          const canLaunchSynteny =
            mateAssembly !== undefined &&
            getSession(self).assemblyManager.assemblyNamesList.includes(
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
                                getContainingView(self) as LinearGenomeViewModel,
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
        trackMenuItems() {
          const groupedByMate = self.groupBy?.type === 'mateAssembly'
          return [
            getFeatureHeightMenuItem(self),
            getColorByMenuItem(self, {
              colorOptions: pickColorOptions(
                'normal',
                'strand',
                'mappingQuality',
              ),
            }),
            getFiltersMenuItem(self),
            {
              label: 'Group by mate sample',
              type: 'checkbox' as const,
              checked: groupedByMate,
              icon: WorkspacesIcon,
              onClick: () => {
                self.setGroupBy(
                  groupedByMate ? undefined : { type: 'mateAssembly' },
                )
              },
            },
          ]
        },
      }))
  )
}

export default stateModelFactory
