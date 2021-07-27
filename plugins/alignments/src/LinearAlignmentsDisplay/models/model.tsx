import React from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import deepEqual from 'fast-deep-equal'
import { autorun, when } from 'mobx'
import { addDisposer, getSnapshot, Instance, types } from 'mobx-state-tree'
import { getContainingTrack } from '@jbrowse/core/util'
import { AlignmentsConfigModel } from './configSchema'

const minDisplayHeight = 20
const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: AlignmentsConfigModel,
) => {
  return types
    .compose(
      'LinearAlignmentsDisplay',
      BaseDisplay,
      types.model({
        PileupDisplay: types.maybe(
          pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
        ),
        SNPCoverageDisplay: types.maybe(
          pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
        ),
        snpCovHeight: 45,
        type: types.literal('LinearAlignmentsDisplay'),
        configuration: ConfigurationReference(configSchema),
        height: 250,
        showCoverage: true,
        showPileup: true,
      }),
    )
    .volatile(() => ({
      scrollTop: 0,
    }))
    .actions(self => ({
      toggleCoverage() {
        self.showCoverage = !self.showCoverage
      },
      togglePileup() {
        self.showPileup = !self.showPileup
      },
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },
      setSNPCoverageHeight(n: number) {
        self.snpCovHeight = n
      },
    }))
    .views(self => {
      const { trackMenuItems } = self
      return {
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

        getFeatureByID(id: string) {
          return self.PileupDisplay.getFeatureByID(id)
        },

        get features() {
          return self.PileupDisplay.features
        },

        get DisplayBlurb() {
          return self.PileupDisplay?.DisplayBlurb
        },

        get sortedBy() {
          return self.PileupDisplay.sortedBy
        },
        get sortedByPosition() {
          return self.PileupDisplay.sortedByPosition
        },
        get sortedByRefName() {
          return self.PileupDisplay.sortedByRefName
        },

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

        get trackMenuItems(): MenuItem[] {
          return [
            ...trackMenuItems,
            {
              type: 'subMenu',
              label: 'Pileup settings',
              subMenu: self.PileupDisplay.composedTrackMenuItems,
            },
            {
              type: 'subMenu',
              label: 'SNPCoverage settings',
              subMenu: [
                ...self.SNPCoverageDisplay.composedTrackMenuItems,
                ...self.SNPCoverageDisplay.extraTrackMenuItems,
              ],
            },
          ]
        },
      }
    })
    .actions(self => ({
      setSNPCoverageDisplay(displayConfig: AnyConfigurationModel) {
        self.SNPCoverageDisplay = {
          type: 'LinearSNPCoverageDisplay',
          configuration: displayConfig,
          height: self.snpCovHeight,
        }
      },
      setUserBpPerPxLimit(limit: number) {
        self.PileupDisplay.setUserBpPerPxLimit(limit)
        self.SNPCoverageDisplay.setUserBpPerPxLimit(limit)
      },
      setPileupDisplay(displayConfig: AnyConfigurationModel) {
        self.PileupDisplay = {
          type: 'LinearPileupDisplay',
          configuration: displayConfig,
        }
      },
      setHeight(displayHeight: number) {
        if (displayHeight > minDisplayHeight) {
          self.height = displayHeight
        } else {
          self.height = minDisplayHeight
        }
        return self.height
      },
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
      async renderSvg(opts: { rasterizeLayers?: boolean }) {
        const pileupHeight = self.height - self.SNPCoverageDisplay.height
        await when(() => self.PileupDisplay.ready)
        return (
          <>
            <g>{await self.SNPCoverageDisplay.renderSvg(opts)}</g>
            <g transform={`translate(0 ${self.SNPCoverageDisplay.height})`}>
              {
                await self.PileupDisplay.renderSvg({
                  ...opts,
                  overrideHeight: pileupHeight,
                })
              }
            </g>
          </>
        )
      },
    }))
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
