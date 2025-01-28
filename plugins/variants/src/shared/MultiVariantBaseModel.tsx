import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { linearBareDisplayStateModelFactory } from '@jbrowse/plugin-linear-genome-view'
import deepEqual from 'fast-deep-equal'
import { types } from 'mobx-state-tree'

import type { SampleInfo, Source } from '../types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from 'mobx-state-tree'

// lazies
const SetColorDialog = lazy(() => import('../shared/SetColorDialog'))
const MAFFilterDialog = lazy(() => import('../shared/MAFFilterDialog'))
const ClusterDialog = lazy(() => import('../shared/ClusterDialog'))

/**
 * #stateModel MultiVariantBaseModel
 * extends
 * - [LinearBareDisplay](../linearbaredisplay)
 */
export default function MultiVariantBaseModelF(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      linearBareDisplayStateModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearVariantMatrixDisplay'),

        /**
         * #property
         */
        layout: types.optional(types.frozen<Source[]>(), []),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        minorAlleleFrequencyFilter: types.optional(types.number, 0.1),

        /**
         * #property
         */
        showSidebarLabelsSetting: true,

        /**
         * #property
         */
        renderingMode: types.optional(types.string, 'none'),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      sourcesLoadingStopToken: undefined as string | undefined,
      /**
       * #volatile
       */
      featureUnderMouseVolatile: undefined as Feature | undefined,
      /**
       * #volatile
       */
      sourcesVolatile: undefined as Source[] | undefined,
      /**
       * #volatile
       */
      featuresVolatile: undefined as Feature[] | undefined,
      /**
       * #volatile
       */
      lineZoneHeight: 20,
      /**
       * #volatile
       */
      hasPhased: false,
      /**
       * #volatile
       */
      sampleInfo: undefined as undefined | Record<string, SampleInfo>,
      /**
       * #volatile
       */
      hoveredGenotype: undefined as string | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setHoveredGenotype(arg: string) {
        self.hoveredGenotype = arg
      },
      /**
       * #action
       */
      setFeatures(f: Feature[]) {
        self.featuresVolatile = f
      },
      /**
       * #action
       */
      setLayout(layout: Source[]) {
        self.layout = layout
      },
      /**
       * #action
       */
      clearLayout() {
        self.layout = []
      },
      /**
       * #action
       */
      setSourcesLoading(str: string) {
        if (self.sourcesLoadingStopToken) {
          stopStopToken(self.sourcesLoadingStopToken)
        }
        self.sourcesLoadingStopToken = str
      },

      /**
       * #action
       */
      setSources(sources: Source[]) {
        if (!deepEqual(sources, self.sourcesVolatile)) {
          self.sourcesVolatile = sources
        }
      },
      /**
       * #action
       */
      setMafFilter(arg: number) {
        self.minorAlleleFrequencyFilter = arg
      },
      /**
       * #action
       */
      setShowSidebarLabels(arg: boolean) {
        self.showSidebarLabelsSetting = arg
      },
      /**
       * #action
       */
      setPhasedMode(arg: string) {
        self.renderingMode = arg
      },
      /**
       * #action
       */
      setHasPhased(arg: boolean) {
        self.hasPhased = arg
      },
      /**
       * #action
       */
      setSampleInfo(arg: Record<string, SampleInfo>) {
        if (!deepEqual(arg, self.sampleInfo)) {
          self.sampleInfo = arg
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get preSources() {
        return self.layout.length ? self.layout : self.sourcesVolatile
      },
      /**
       * #getter
       */
      get sources() {
        if (this.preSources) {
          const rows = []
          const sources = Object.fromEntries(
            self.sourcesVolatile?.map(s => [s.name, s]) || [],
          )
          for (const row of this.preSources) {
            // make separate rows for each haplotype in phased mode
            if (self.renderingMode === 'phased') {
              const info = self.sampleInfo?.[row.name]
              if (info?.isPhased) {
                const ploidy = info.maxPloidy
                for (let i = 0; i < ploidy; i++) {
                  const id = `${row.name} HP${i}`
                  rows.push({
                    ...sources[row.name],
                    ...row,
                    label: id,
                    HP: i,
                    id: id,
                  })
                }
              }
            }
            // non-phased mode does not make separate rows
            else {
              rows.push({
                ...sources[row.name],
                ...row,
                label: row.name,
                id: row.name,
              })
            }
          }
          return rows
        }
        return undefined
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self

      return {
        /**
         * #method
         */
        adapterProps() {
          const superProps = superRenderProps()
          return {
            ...superProps,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            config: self.rendererConfig,
          }
        },
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Show sidebar labels',
              type: 'checkbox',
              checked: self.showSidebarLabelsSetting,
              onClick: () => {
                self.setShowSidebarLabels(!self.showSidebarLabelsSetting)
              },
            },

            ...(self.hasPhased
              ? [
                  {
                    label: 'Rendering mode',
                    type: 'subMenu',
                    subMenu: [
                      {
                        label: 'Allele count mode',
                        type: 'radio',
                        checked: self.renderingMode === 'none',
                        onClick: () => {
                          self.setPhasedMode('none')
                        },
                      },
                      {
                        label: 'Phased',
                        checked: self.renderingMode === 'phased',
                        type: 'radio',
                        onClick: () => {
                          self.setPhasedMode('phased')
                        },
                      },
                    ],
                  },
                ]
              : []),
            {
              label: 'Filter by minor allele frequency',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  MAFFilterDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              label: 'Cluster by genotype',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ClusterDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              label: 'Edit colors/arrangement...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetColorDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
}

export type MultiVariantBaseStateModel = ReturnType<
  typeof MultiVariantBaseModelF
>
export type MultiVariantBaseModel = Instance<MultiVariantBaseStateModel>
