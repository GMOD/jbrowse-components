import { types, Instance } from 'mobx-state-tree'

import {
  clamp,
  getSession,
  parseLocString,
  getContainingView,
} from '@jbrowse/core/util'
import { MenuItem } from '@jbrowse/core/ui'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import ExportSvgDlg from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/components/ExportSvgDialog'
import PluginManager from '@jbrowse/core/PluginManager'

import { ElementId } from '@jbrowse/core/util/types/mst'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import LabelIcon from '@mui/icons-material/Label'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
  coord?: number
  reversed?: boolean
  assemblyName?: string
  oob?: boolean
}

export default function stateModelFactory(pluginManager: PluginManager) {
  return types.compose(
    'LinearGenomeMultilevelView',
    pluginManager.getViewType('LinearGenomeView')
      .stateModel as LinearGenomeViewStateModel,

    types
      .model({
        id: ElementId,
        type: types.literal('LinearGenomeMultilevelView'),

        hideControls: true,
        isVisible: true,
        hasCustomMiniControls: true,
        hasCustomHeader: true,
        isAnchor: false,
        isOverview: false,

        limitBpPerPx: types.optional(types.frozen(), {
          limited: false,
          upperLimit: 1,
          lowerLimit: 0,
        }),

        polygonPoints: types.optional(types.frozen(), {
          left: -1,
          right: -1,
          prevLeft: -1,
          prevRight: -1,
        }),
      })
      .actions(self => ({
        toggleControls() {
          self.hideControls = !self.hideControls
        },
        toggleVisible() {
          self.isVisible = !self.isVisible
        },
        toggleIsAnchor() {
          self.isAnchor = !self.isAnchor
        },
        toggleIsOverview() {
          self.isOverview = !self.isOverview
        },
        setCustomMiniControls(flag: boolean) {
          self.hasCustomMiniControls = flag
        },
        setHasCustomHeader(flag: boolean) {
          self.hasCustomHeader = flag
        },
        setLimitBpPerPx(
          limited: boolean,
          upperLimit?: number,
          lowerLimit?: number,
        ) {
          self.limitBpPerPx = {
            limited: limited,
            upperLimit: upperLimit ? upperLimit : self.limitBpPerPx.upperLimit,
            lowerLimit: lowerLimit ? lowerLimit : self.limitBpPerPx.lowerLimit,
          }
        },
        setPolygonPoints(
          left: number,
          right: number,
          prevLeft: number,
          prevRight: number,
        ) {
          self.polygonPoints = {
            left: left,
            right: right,
            prevLeft: prevLeft,
            prevRight: prevRight,
          }
        },
        zoomTo(bpPerPx: number) {
          if (
            !self.limitBpPerPx.limited ||
            (bpPerPx <= self.limitBpPerPx.upperLimit &&
              bpPerPx >= self.limitBpPerPx.lowerLimit)
          ) {
            // @ts-ignore
            const newBpPerPx = clamp(bpPerPx, self.minBpPerPx, self.maxBpPerPx)
            // @ts-ignore
            if (newBpPerPx === self.bpPerPx) {
              return newBpPerPx
            }
            // @ts-ignore
            const oldBpPerPx = self.bpPerPx
            // @ts-ignore
            self.bpPerPx = newBpPerPx

            if (Math.abs(oldBpPerPx - newBpPerPx) < 0.000001) {
              console.warn('zoomTo bpPerPx rounding error')
              return oldBpPerPx
            }

            // @ts-ignore
            const viewWidth = self.width
            // @ts-ignore
            self.scrollTo(
              Math.round(
                // @ts-ignore
                ((self.offsetPx + viewWidth / 2) * oldBpPerPx) / newBpPerPx -
                  viewWidth / 2,
              ),
            )
            return newBpPerPx
          }
          // @ts-ignore
          return self.bpPerPx
        },
        navToLocString(locString: string, optAssemblyName?: string) {
          // @ts-ignore
          const { assemblyNames } = self
          const { assemblyManager } = getSession(self)
          const { isValidRefName } = assemblyManager
          const assemblyName = optAssemblyName || assemblyNames[0]

          const parsedLocStrings = locString
            .split(' ')
            .filter(f => !!f.trim())
            .map(l =>
              parseLocString(l, ref => isValidRefName(ref, assemblyName)),
            )

          const locations = parsedLocStrings.map(region => {
            const asmName = region.assemblyName || assemblyName
            const asm = assemblyManager.get(asmName)
            const { refName } = region
            if (!asm) {
              throw new Error(`assembly ${asmName} not found`)
            }
            const { regions } = asm
            if (!regions) {
              throw new Error(`regions not loaded yet for ${asmName}`)
            }
            const canonicalRefName = asm.getCanonicalRefName(region.refName)
            if (!canonicalRefName) {
              throw new Error(
                `Could not find refName ${refName} in ${asm.name}`,
              )
            }
            const parentRegion = regions.find(
              region => region.refName === canonicalRefName,
            )
            if (!parentRegion) {
              throw new Error(`Could not find refName ${refName} in ${asmName}`)
            }

            return {
              ...region,
              assemblyName: asmName,
              parentRegion,
            }
          })

          if (locations.length === 1) {
            const loc = locations[0]
            // @ts-ignore
            self.setDisplayedRegions([
              { reversed: loc.reversed, ...loc.parentRegion },
            ])
            const { start, end, parentRegion } = loc
            // @ts-ignore
            self.navTo({
              ...loc,
              start: clamp(start ?? 0, 0, parentRegion.end),
              end: clamp(end ?? parentRegion.end, 0, parentRegion.end),
            })
          } else {
            // @ts-ignore
            self.setDisplayedRegions(
              // @ts-ignore
              locations.map(r => (r.start === undefined ? r.parentRegion : r)),
            )
            // @ts-ignore
            self.showAllRegions()
          }
        },
        moveIfAnchor(leftOffset: number, rightOffset: number) {
          if (self.isAnchor) {
            // @ts-ignore
            self.moveTo(leftOffset, rightOffset)
          }
        },
        closeView() {
          const parent = getContainingView(self)
          parent.removeView(self)
        },
        addView(isAbove: boolean) {
          const parent = getContainingView(self)
          parent.addView(isAbove, self)
        },
      }))
      .views(self => ({
        menuItems(): MenuItem[] {
          // @ts-ignore
          const { canShowCytobands, showCytobands } = self

          const menuItems: MenuItem[] = [
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDlg,
                  { model: self, handleClose },
                ])
              },
            },
            {
              label: 'Open track selector',
              // @ts-ignore
              onClick: self.activateTrackSelector,
              icon: TrackSelectorIcon,
            },
            {
              label: 'Horizontally flip',
              icon: SyncAltIcon,
              // @ts-ignore
              onClick: self.horizontallyFlip,
            },
            !self.isAnchor && !self.isOverview
              ? {
                  label: 'Remove view',
                  icon: CloseIcon,
                  onClick: self.closeView,
                }
              : {
                  label: 'This view cannot be removed',
                  icon: CloseIcon,
                  disabled: true,
                  onClick: () => {},
                },
            {
              label: 'Add neighbouring view',
              icon: AddIcon,
              subMenu: [
                {
                  label: 'Add view above',
                  icon: VerticalAlignTopIcon,
                  onClick: () => {
                    self.addView(true)
                  },
                },
                {
                  label: 'Add view below',
                  icon: VerticalAlignBottomIcon,
                  onClick: () => {
                    self.addView(false)
                  },
                },
              ],
            },
            { type: 'divider' },
            {
              label: 'Show all regions in assembly',
              icon: VisibilityIcon,
              // @ts-ignore
              onClick: self.showAllRegionsInAssembly,
            },
            {
              label: 'Show center line',
              icon: VisibilityIcon,
              type: 'checkbox',
              // @ts-ignore
              checked: self.showCenterLine,
              // @ts-ignore
              onClick: self.toggleCenterLine,
            },
            {
              label: 'Show header',
              icon: VisibilityIcon,
              type: 'checkbox',
              // @ts-ignore
              checked: !self.hideHeader,
              // @ts-ignore
              onClick: self.toggleHeader,
            },
            {
              label: 'Show header overview',
              icon: VisibilityIcon,
              type: 'checkbox',
              // @ts-ignore
              checked: !self.hideHeaderOverview,
              // @ts-ignore
              onClick: self.toggleHeaderOverview,
              // @ts-ignore
              disabled: self.hideHeader,
            },
            {
              label: 'Show no tracks active button',
              icon: VisibilityIcon,
              type: 'checkbox',
              // @ts-ignore
              checked: !self.hideNoTracksActive,
              // @ts-ignore
              onClick: self.toggleNoTracksActive,
            },
            {
              label: 'Show controls',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: !self.hideControls,
              onClick: self.toggleControls,
              disabled: !self.isVisible || self.isAnchor,
            },
            {
              label: 'Track labels',
              icon: LabelIcon,
              subMenu: [
                {
                  label: 'Overlapping',
                  icon: VisibilityIcon,
                  type: 'radio',
                  // @ts-ignore
                  checked: self.trackLabels === 'overlapping',
                  // @ts-ignore
                  onClick: () => self.setTrackLabels('overlapping'),
                },
                {
                  label: 'Offset',
                  icon: VisibilityIcon,
                  type: 'radio',
                  // @ts-ignore
                  checked: self.trackLabels === 'offset',
                  // @ts-ignore
                  onClick: () => self.setTrackLabels('offset'),
                },
                {
                  label: 'Hidden',
                  icon: VisibilityIcon,
                  type: 'radio',
                  // @ts-ignore
                  checked: self.trackLabels === 'hidden',
                  // @ts-ignore
                  onClick: () => self.setTrackLabels('hidden'),
                },
              ],
            },
            ...(canShowCytobands
              ? [
                  {
                    label: showCytobands ? 'Hide ideogram' : 'Show ideograms',
                    onClick: () => {
                      // @ts-ignore
                      self.setShowCytobands(!showCytobands)
                    },
                  },
                ]
              : []),
          ]

          return menuItems
        },
      }))
      .views(self => {
        // @ts-ignore
        const { rubberBandMenuItems: superMenuItems } = self

        const superMenuItemsArray = superMenuItems()

        const index = superMenuItemsArray.findIndex(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) => item.label === 'Zoom to region',
        )
        superMenuItemsArray.splice(index, 1)
        return {
          rubberBandMenuItems(): MenuItem[] {
            return [
              {
                label: 'Zoom to region',
                icon: ZoomInIcon,
                onClick: () => {
                  // @ts-ignore
                  const { leftOffset, rightOffset } = self
                  if (leftOffset && rightOffset) {
                    self.moveIfAnchor(leftOffset, rightOffset)
                  }
                },
              },
              ...superMenuItemsArray,
            ]
          },
        }
      }),
  )
}

export type LinearGenomeMultilevelViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearGenomeMultilevelViewModel =
  Instance<LinearGenomeMultilevelViewStateModel>
