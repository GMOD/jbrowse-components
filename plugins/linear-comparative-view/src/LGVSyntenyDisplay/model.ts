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
        const session = getSession(self)
        session.setSelection(feature)
        if (isSessionModelWithWidgets(session)) {
          const { type, id } = self.featureWidgetType
          let view = getContainingView(self)
          try {
            view = getContainingView(view)
          } catch (_e) {
            /* already at top-level */
          }
          session.showWidget(
            session.addWidget(type, id, {
              featureData: feature.toJSON(),
              view,
              track: getContainingTrack(self),
            }),
          )
        }
      },
      afterCreate() {
        const alignSelf = self as unknown as {
          colorBySetting: unknown
          colorBy: { type: string }
          setColorScheme(scheme: { type: string }): void
        }
        if (!alignSelf.colorBySetting && alignSelf.colorBy.type === 'normal') {
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
