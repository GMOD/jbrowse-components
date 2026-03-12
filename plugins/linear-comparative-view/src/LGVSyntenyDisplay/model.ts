import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
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

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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
    .preProcessSnapshot(snap => ({
      showCoverage: false,
      ...snap,
    }))
    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const r2 = getContainingView(self)
          let r3 = r2
          try {
            r3 = getContainingView(r3)
          } catch (e) {}
          const featureWidget = session.addWidget(
            'SyntenyFeatureWidget',
            'syntenyFeature',
            {
              featureData: feature.toJSON(),
              view: r3,
              track: getContainingTrack(self),
            },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },
      afterCreate() {
        if (!self.colorBySetting && self.colorBy.type === 'normal') {
          self.setColorScheme({ type: 'strand' })
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
                      view: getContainingView(self) as LGV,
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
                  const { uniqueId, ...rest } = feature.toJSON()
                  const session = getSession(self)
                  const { default: copy } = await import('copy-to-clipboard')
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
        const items: MenuItem[] = [
          getFeatureHeightMenuItem(self),
          getColorByMenuItem(self, {
            colorOptions: [
              { label: 'Normal', type: 'normal' },
              { label: 'Strand', type: 'strand' },
              { label: 'Mapping quality', type: 'mappingQuality' },
              // TODO: implement
              { label: 'Query name', type: 'query' },
            ],
          }),
          getFiltersMenuItem(self),
        ]
        return items
      },
    }))
}

export default stateModelFactory
