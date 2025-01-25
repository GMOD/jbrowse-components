import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { linearBareDisplayStateModelFactory } from '@jbrowse/plugin-linear-genome-view'
import deepEqual from 'fast-deep-equal'
import { isAlive, types } from 'mobx-state-tree'

import type { Source } from '../types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

// lazies
const SetColorDialog = lazy(() => import('../shared/SetColorDialog'))
const MAFFilterDialog = lazy(() => import('../shared/MAFFilterDialog'))
const ClusterDialog = lazy(() => import('../shared/ClusterDialog'))

/**
 * #stateModel LinearVariantMatrixDisplay
 * extends
 * - [LinearBareDisplay](../linearbaredisplay)
 */
export default function stateModelFactory(
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
        phasedMode: types.optional(types.string, 'none'),
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
    }))
    .actions(self => ({
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
        self.phasedMode = arg
      },
    }))
    .views(self => ({
      get preSources() {
        return self.layout.length ? self.layout : self.sourcesVolatile
      },
      /**
       * #getter
       */
      get sources() {
        const sources = Object.fromEntries(
          self.sourcesVolatile?.map(s => [s.name, s]) || [],
        )
        return this.preSources?.map(s => ({
          ...sources[s.name],
          ...s,
        }))
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
            {
              label: 'Phased mode',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Use unphased drawing mode (count alleles)',
                  checked: self.phasedMode === 'none',
                  onClick: () => {
                    self.setPhasedMode('none')
                  },
                },
                {
                  label:
                    'Only draw phased variants (split phase into haplotyp rows)',
                  checked: self.phasedMode === 'phasedOnly',
                  onClick: () => {
                    self.setPhasedMode('phasedOnly')
                  },
                },
                {
                  label: 'Draw both phased and unphased (odd mix of both)',
                  checked: self.phasedMode === 'both',
                  onClick: () => {
                    self.setPhasedMode('both')
                  },
                },
              ],
            },
            {
              label: 'Set minor allele frequency filter',
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
    .views(self => ({
      /**
       * #getter
       */
      get blockType() {
        return 'dynamicBlocks'
      },
      /**
       * #getter
       */
      get totalHeight() {
        return self.height - self.lineZoneHeight
      },

      /**
       * #getter
       */
      get rowHeight() {
        return this.totalHeight / (self.sources?.length || 1)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      renderProps() {
        const superProps = self.adapterProps()
        return {
          ...superProps,
          notReady:
            superProps.notReady || !self.sources || !self.featuresVolatile,
          phasedMode: self.phasedMode,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          height: self.totalHeight,
          sources: self.sources,
        }
      },
      /**
       * #getter
       */
      get canDisplayLabels() {
        return self.rowHeight > 8 && self.showSidebarLabelsSetting
      },
    }))
    .actions(self => {
      const { renderSvg: superRenderSvg } = self
      return {
        afterAttach() {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              const { getMultiVariantSourcesAutorun } = await import(
                '../getMultiVariantSourcesAutorun'
              )
              const { getMultiVariantFeaturesAutorun } = await import(
                '../getMultiVariantFeaturesAutorun'
              )
              getMultiVariantSourcesAutorun(self)
              getMultiVariantFeaturesAutorun(self)
            } catch (e) {
              if (isAlive(self)) {
                console.error(e)
                getSession(self).notifyError(`${e}`, e)
              }
            }
          })()
        },

        /**
         * #action
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg')
          return renderSvg(self, opts, superRenderSvg)
        },
      }
    })
}

export type MultiLinearVariantMatrixDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearVariantMatrixDisplayModel =
  Instance<MultiLinearVariantMatrixDisplayStateModel>
