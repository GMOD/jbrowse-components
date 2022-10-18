import React from 'react'
import {
  ConfigurationReference,
  AnyConfigurationModel,
  getConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import { autorun, when } from 'mobx'
import { addDisposer, getSnapshot, Instance, types } from 'mobx-state-tree'
import { getContainingTrack } from '@jbrowse/core/util'
import deepEqual from 'fast-deep-equal'
import { AlignmentsConfigModel } from './configSchema'

const minDisplayHeight = 20

/**
 * !stateModel LinearAlignmentsDisplay
 * extends `BaseDisplay`
 */
const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: AlignmentsConfigModel,
) => {
  return types
    .compose(
      'LinearAlignmentsDisplay',
      BaseDisplay,
      types.model({
        /**
         * !property
         * refers to LinearPileupDisplay sub-display model
         */
        PileupDisplay: types.maybe(
          pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
        ),
        /**
         * !property
         * refers to LinearSNPCoverageDisplay sub-display model
         */
        SNPCoverageDisplay: types.maybe(
          pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
        ),
        /**
         * !property
         */
        snpCovHeight: 45,
        /**
         * !property
         */
        type: types.literal('LinearAlignmentsDisplay'),
        /**
         * !property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * !property
         */
        height: 250,
        /**
         * !property
         */
        showCoverage: true,
        /**
         * !property
         */
        showPileup: true,
        /**
         * !property
         */
        userFeatureScreenDensity: types.maybe(types.number),
      }),
    )
    .volatile(() => ({
      scrollTop: 0,
    }))
    .actions(self => ({
      /**
       * !action
       */
      toggleCoverage() {
        self.showCoverage = !self.showCoverage
      },
      /**
       * !action
       */
      togglePileup() {
        self.showPileup = !self.showPileup
      },
      /**
       * !action
       */
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },

      /**
       * !action
       */
      setSNPCoverageHeight(n: number) {
        self.snpCovHeight = n
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * !getter
         */
        get pileupDisplayConfig() {
          const conf = getConf(self, 'pileupDisplay')
          const track = getContainingTrack(self)
          return {
            ...conf,
            type: 'LinearPileupDisplay',
            name: `${getConf(track, 'name')} pileup`,
            displayId: `${self.configuration.displayId}_pileup_xyz`, // xyz to avoid someone accidentally naming the displayId similar to this
          }
        },

        /**
         * !method
         */
        getFeatureByID(blockKey: string, id: string) {
          return self.PileupDisplay.getFeatureByID(blockKey, id)
        },
        /**
         * !method
         */
        searchFeatureByID(id: string) {
          return self.PileupDisplay.searchFeatureByID(id)
        },

        /**
         * !getter
         */
        get features() {
          return self.PileupDisplay.features
        },

        /**
         * !getter
         */
        get DisplayBlurb() {
          return self.PileupDisplay?.DisplayBlurb
        },

        /**
         * !getter
         */
        get sortedBy() {
          return self.PileupDisplay.sortedBy
        },
        /**
         * !getter
         */
        get sortedByPosition() {
          return self.PileupDisplay.sortedByPosition
        },
        /**
         * !getter
         */
        get sortedByRefName() {
          return self.PileupDisplay.sortedByRefName
        },

        /**
         * !getter
         */
        get snpCoverageDisplayConfig() {
          const conf = getConf(self, 'snpCoverageDisplay')
          const track = getContainingTrack(self)
          return {
            ...conf,
            type: 'LinearSNPCoverageDisplay',
            name: `${getConf(track, 'name')} snp coverage`,
            displayId: `${self.configuration.displayId}_snpcoverage_xyz`, // xyz to avoid someone accidentally naming the displayId similar to this
          }
        },

        /**
         * !method
         */
        trackMenuItems(): MenuItem[] {
          return [
            ...superTrackMenuItems(),
            {
              type: 'subMenu',
              label: 'Pileup settings',
              subMenu: self.PileupDisplay.trackMenuItems(),
            },
            {
              type: 'subMenu',
              label: 'SNPCoverage settings',
              subMenu: self.SNPCoverageDisplay.trackMenuItems(),
            },
          ]
        },
      }
    })
    .actions(self => ({
      /**
       * !action
       */
      setSNPCoverageDisplay(displayConfig: AnyConfigurationModel) {
        self.SNPCoverageDisplay = {
          type: 'LinearSNPCoverageDisplay',
          configuration: displayConfig,
          height: self.snpCovHeight,
        }
      },
      /**
       * !action
       */
      setUserFeatureScreenDensity(limit: number) {
        self.PileupDisplay.setUserFeatureScreenDensity(limit)
        self.SNPCoverageDisplay.setUserFeatureScreenDensity(limit)
      },
      /**
       * !action
       */
      setPileupDisplay(displayConfig: AnyConfigurationModel) {
        self.PileupDisplay = {
          type: 'LinearPileupDisplay',
          configuration: displayConfig,
        }
      },
      /**
       * !action
       */
      setHeight(displayHeight: number) {
        if (displayHeight > minDisplayHeight) {
          self.height = displayHeight
        } else {
          self.height = minDisplayHeight
        }
        return self.height
      },
      /**
       * !action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            if (!self.SNPCoverageDisplay) {
              self.setSNPCoverageDisplay(self.snpCoverageDisplayConfig)
            } else if (
              !deepEqual(
                self.snpCoverageDisplayConfig,
                getSnapshot(self.SNPCoverageDisplay.configuration),
              )
            ) {
              self.SNPCoverageDisplay.setHeight(self.snpCovHeight)
              self.SNPCoverageDisplay.setConfig(self.snpCoverageDisplayConfig)
            }

            if (!self.PileupDisplay) {
              self.setPileupDisplay(self.pileupDisplayConfig)
            } else if (
              !deepEqual(
                self.pileupDisplayConfig,
                getSnapshot(self.PileupDisplay.configuration),
              )
            ) {
              self.PileupDisplay.setConfig(self.pileupDisplayConfig)
            }

            // propagate the filterBy setting from pileupdisplay to snpcoverage
            // note: the snpcoverage display is not able to control filterBy
            // itself
            if (
              self.PileupDisplay.filterBy &&
              !deepEqual(
                getSnapshot(self.PileupDisplay.filterBy),
                getSnapshot(self.SNPCoverageDisplay.filterBy),
              )
            ) {
              self.SNPCoverageDisplay.setFilterBy(
                getSnapshot(self.PileupDisplay.filterBy),
              )
            }
            if (
              self.PileupDisplay.colorBy &&
              !deepEqual(
                getSnapshot(self.PileupDisplay.colorBy),
                self.SNPCoverageDisplay.colorBy
                  ? getSnapshot(self.SNPCoverageDisplay.colorBy)
                  : {},
              )
            ) {
              self.SNPCoverageDisplay.setColorBy(
                getSnapshot(self.PileupDisplay.colorBy),
              )
            }
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            self.setSNPCoverageHeight(self.SNPCoverageDisplay.height)
          }),
        )
      },
      /**
       * !action
       */
      async renderSvg(opts: { rasterizeLayers?: boolean }) {
        const pileupHeight = self.height - self.SNPCoverageDisplay.height
        await when(() => self.PileupDisplay.ready)
        return (
          <>
            <g>{await self.SNPCoverageDisplay.renderSvg(opts)}</g>
            <g transform={`translate(0 ${self.SNPCoverageDisplay.height})`}>
              {await self.PileupDisplay.renderSvg({
                ...opts,
                overrideHeight: pileupHeight,
              })}
            </g>
          </>
        )
      },
    }))
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
