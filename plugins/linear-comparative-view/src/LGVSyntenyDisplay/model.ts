import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItem,
  linearAlignmentsDisplayStateModelFactory,
} from '@jbrowse/plugin-alignments'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { findVisibleBlockForFeature } from './components/util.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LaunchSyntenyViewDialog = lazy(
  () => import('./components/LaunchSyntenyViewDialog.tsx'),
)

/**
 * #stateModel LGVSyntenyDisplay
 * displays location of "synteny" feature in a plain LGV, allowing linking out
 * to external synteny views
 *
 * extends
 * - [LinearAlignmentsDisplay](../linearalignmentsdisplay)
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
  return types
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
    // The composed LinearAlignmentsDisplay defaults showCoverage to true; synteny
    // display hides coverage by default. MST composition doesn't allow overriding
    // a parent model's property default, so the preProcessSnapshot injection is
    // the correct mechanism — the snapshot wins over the default.
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) => ({
      showCoverage: false,
      ...snap,
    }))
    .views(() => ({
      get featureWidgetType() {
        return {
          type: 'SyntenyFeatureWidget',
          id: 'syntenyFeature',
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON(), {
          widget: self.featureWidgetType,
        })
      },
      afterCreate() {
        const alignSelf = self as unknown as LinearAlignmentsDisplayModel
        if (!alignSelf.getOverride('colorBy')) {
          alignSelf.setColorScheme({ type: 'strand' })
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      contextMenuItems() {
        const feature = self.contextMenuFeature
        return feature
          ? [
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  self.selectFeature(feature)
                },
              },
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
                      trackId: getConf(getContainingTrack(self), 'trackId'),
                      handleClose,
                      session: getSession(self),
                      feature,
                    },
                  ])
                },
              },
              {
                label: 'Copy info to clipboard',
                icon: ContentCopyIcon,
                onClick: async () => {
                  const { uniqueId: _uniqueId, ...rest } = feature.toJSON()
                  const session = getSession(self)
                  const { default: copy } =
                    await import('@jbrowse/core/util/copyToClipboard')
                  copy(JSON.stringify(rest, null, 4))
                  session.notify('Copied to clipboard', 'success')
                },
              },
            ]
          : []
      },
      /**
       * #method
       */
      trackMenuItems() {
        return [
          getFeatureHeightMenuItem(self),
          getColorByMenuItem(self, {
            colorOptions: [
              { label: 'Normal', type: 'normal' },
              { label: 'Strand', type: 'strand' },
              { label: 'Mapping quality', type: 'mappingQuality' },
            ],
          }),
          getFiltersMenuItem(self),
        ]
      },
    }))
}

export default stateModelFactory
