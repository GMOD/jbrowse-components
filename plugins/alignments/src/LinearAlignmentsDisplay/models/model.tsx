import React, { lazy } from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import deepEqual from 'fast-deep-equal'
import { autorun, when } from 'mobx'
import {
  addDisposer,
  getSnapshot,
  cast,
  Instance,
  types,
} from 'mobx-state-tree'
import {
  getSession,
  getContainingTrack,
  getContainingView,
} from '@jbrowse/core/util'
import GroupIcon from '@material-ui/icons/ViewModule'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AlignmentsConfigModel } from './configSchema'
import {
  colorSchemeMenu,
  filterByMenu,
  setDisplayModeMenu,
  colorByModel,
  filterByModel,
  getUniqueTagValues,
} from '../../shared/models'

const GroupByTagDlg = lazy(() => import('../components/GroupByTag'))

type LGV = LinearGenomeViewModel

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
        PileupDisplays: types.maybe(
          types.array(
            pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
          ),
        ),
        SNPCoverageDisplay: types.maybe(
          pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
        ),
        snpCovHeight: 45,
        type: types.literal('LinearAlignmentsDisplay'),
        configuration: ConfigurationReference(configSchema),
        groupBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
          }),
        ),
        colorBy: colorByModel,
        displayMode: types.maybe(types.string),
        filterBy: filterByModel,
        height: 250,
        showCoverage: true,
        showPileup: true,
      }),
    )
    .volatile(() => ({
      scrollTop: 0,
      groups: [] as string[],
      ready: false,
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
      setColorScheme(colorScheme: { type: string; tag?: string }) {
        self.colorBy = cast(colorScheme)
      },
      setFilterBy(filter: {
        flagInclude: number
        flagExclude: number
        readName?: string
        tagFilter?: { tag: string; value: string }
      }) {
        self.filterBy = cast(filter)
      },
      setGroupBy(groupBy: { type: string; tag: string }) {
        self.groupBy = cast(groupBy)
        self.ready = false
      },
      setReady(flag: boolean) {
        self.ready = flag
      },

      updateGroups(groups: string[]) {
        if (JSON.stringify(groups) !== JSON.stringify(self.groups)) {
          self.groups = groups
        }
      },
      setDisplayMode(type?: string) {
        self.displayMode = type
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

        get layoutFeatures() {
          return self.PileupDisplay.layoutFeatures
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

            // When there are multiple PileupDisplays, we hide the
            // PileupDisplay track settings
            ...(self.groups.length
              ? []
              : [
                  {
                    label: 'Pileup settings',
                    subMenu: self.PileupDisplay.composedTrackMenuItems,
                  },
                ]),
            {
              type: 'subMenu',
              label: 'SNPCoverage settings',
              subMenu: [
                ...self.SNPCoverageDisplay.composedTrackMenuItems,
                ...self.SNPCoverageDisplay.extraTrackMenuItems,
              ],
            },

            colorSchemeMenu(self),
            filterByMenu(self),
            setDisplayModeMenu(self),
            {
              label: 'Group by',
              icon: GroupIcon,
              onClick: () => {
                getSession(self).setDialogComponent(GroupByTagDlg, {
                  model: self,
                })
              },
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

      setPileupDisplays(displayConfig: AnyConfigurationModel) {
        self.PileupDisplays = cast(
          self.groups.map(group => ({
            type: 'LinearPileupDisplay',
            configuration: displayConfig,
            filterBy: {
              tagFilter: { tag: self.groupBy?.tag, value: group },
            },
            colorBy: self.colorBy ? getSnapshot(self.colorBy) : undefined,
          })),
        )
      },
      setHeight(displayHeight: number) {
        if (displayHeight > minDisplayHeight) self.height = displayHeight
        else self.height = minDisplayHeight
        return self.height
      },
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
    }))
    .actions(self => {
      let oldGroups = ''
      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(() => {
              // initialize snpcov sub-display at startup
              if (!self.SNPCoverageDisplay) {
                self.setSNPCoverageDisplay(self.snpCoverageDisplayConfig)
              }

              // initialize pileup sub-display at startup
              if (
                self.groups.length &&
                oldGroups !== JSON.stringify(self.groups)
              ) {
                self.setPileupDisplays(self.pileupDisplayConfig)
                oldGroups = JSON.stringify(self.groups)
              } else if (!self.PileupDisplay) {
                self.setPileupDisplay(self.pileupDisplayConfig)
              }

              // propagate updates to the copy of the snpcov display on this
              // model to the subdisplay if changed
              if (
                !deepEqual(
                  self.snpCoverageDisplayConfig,
                  getSnapshot(self.SNPCoverageDisplay.configuration),
                )
              ) {
                self.SNPCoverageDisplay.setConfig(self.snpCoverageDisplayConfig)
                self.SNPCoverageDisplay.setHeight(self.snpCovHeight)
              }

              // propagate updates to the copy of the pileup display on this
              // model to the subdisplay
              if (
                !deepEqual(
                  self.pileupDisplayConfig,
                  getSnapshot(self.PileupDisplay.configuration),
                )
              ) {
                self.PileupDisplay.setConfig(self.pileupDisplayConfig)
              }

              // propagate the filterBy and colorBy settings
              self.SNPCoverageDisplay.setFilterBy(getSnapshot(self.filterBy))
              self.PileupDisplay.setFilterBy(getSnapshot(self.filterBy))
              if (self.colorBy) {
                const { colorBy } = self
                self.SNPCoverageDisplay.setColorScheme(getSnapshot(colorBy))
                if (self.groups.length) {
                  self.PileupDisplays?.forEach(disp =>
                    disp.setColorScheme(getSnapshot(colorBy)),
                  )
                } else {
                  self.PileupDisplay.setColorScheme(getSnapshot(colorBy))
                }
              }

              if (self.displayMode) {
                const { displayMode } = self
                if (self.groups.length) {
                  self.PileupDisplays?.forEach(disp =>
                    disp.setDisplayMode(displayMode),
                  )
                } else {
                  self.PileupDisplay.setDisplayMode(displayMode)
                }
              }
            }),
          )
          addDisposer(
            self,
            autorun(() => {
              self.setSNPCoverageHeight(self.SNPCoverageDisplay.height)
            }),
          )

          addDisposer(
            self,
            autorun(async () => {
              try {
                const { groupBy } = self
                const view = getContainingView(self) as LGV

                // continually generate the vc pairing, set and rerender if any
                // new values seen
                if (groupBy?.tag) {
                  const uniqueTagSet = await getUniqueTagValues(
                    self,
                    view.staticBlocks.contentBlocks,
                    groupBy.tag,
                  )
                  self.updateGroups(uniqueTagSet)
                }
                self.setReady(true)
              } catch (e) {
                console.error(e)
              }
            }),
          )
        },
        async renderSvg(opts: { rasterizeLayers?: boolean }) {
          const pileupHeight = self.height - self.SNPCoverageDisplay.height
          if (self.groups.length) {
            await Promise.all(
              self.PileupDisplays?.map(disp => when(() => disp.ready)) || [],
            )
          } else {
            await when(() => self.PileupDisplay.ready)
          }
          let currOffset = 0
          return (
            <>
              <g>{await self.SNPCoverageDisplay.renderSvg(opts)}</g>
              <g transform={`translate(0 ${self.SNPCoverageDisplay.height})`}>
                {
                  await (self.PileupDisplays?.length
                    ? Promise.all(
                        self.PileupDisplays.map(async (disp, index) => {
                          const {
                            reactElement,
                            layoutHeight,
                          } = await disp.renderSvg({
                            ...opts,
                            overrideHeight: pileupHeight,
                          })

                          const offset = layoutHeight + 10
                          currOffset += offset
                          return (
                            <g
                              key={`${Math.random}`}
                              transform={`translate(0 ${currOffset - offset})`}
                            >
                              <text fontSize={10} y={10}>
                                {self.groupBy?.tag} {self.groups[index]}
                              </text>
                              <g transform="translate(0 10)">{reactElement}</g>
                            </g>
                          )
                        }),
                      )
                    : self.PileupDisplay.renderSvg({
                        ...opts,
                        overrideHeight: pileupHeight,
                      }))
                }
              </g>
            </>
          )
        },
      }
    })
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
