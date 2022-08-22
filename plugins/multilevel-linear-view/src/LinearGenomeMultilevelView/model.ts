import { types, Instance } from 'mobx-state-tree'

import {
  clamp,
  getSession,
  parseLocString,
  getContainingView,
} from '@jbrowse/core/util'
import { MenuItem } from '@jbrowse/core/ui'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

import { ElementId } from '@jbrowse/core/util/types/mst'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom'
import MiniControls from '../MultilevelLinearView/components/MiniControls'
import Header from '../MultilevelLinearView/components/Header'

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
  return (
    pluginManager.getViewType('LinearGenomeView')
      .stateModel as LinearGenomeViewStateModel
  )
    .named('LinearGenomeMultilevelView')
    .props({
      id: ElementId,
      type: types.literal('LinearGenomeMultilevelView'),

      hideControls: true,
      isVisible: true,
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
          const newBpPerPx = clamp(bpPerPx, self.minBpPerPx, self.maxBpPerPx)

          if (newBpPerPx === self.bpPerPx) {
            return newBpPerPx
          }

          const oldBpPerPx = self.bpPerPx

          self.bpPerPx = newBpPerPx

          if (Math.abs(oldBpPerPx - newBpPerPx) < 0.000001) {
            console.warn('zoomTo bpPerPx rounding error')
            return oldBpPerPx
          }

          const viewWidth = self.width

          self.scrollTo(
            Math.round(
              ((self.offsetPx + viewWidth / 2) * oldBpPerPx) / newBpPerPx -
                viewWidth / 2,
            ),
          )
          return newBpPerPx
        }
        return self.bpPerPx
      },
      navToLocString(locString: string, optAssemblyName?: string) {
        const { assemblyNames } = self
        const { assemblyManager } = getSession(self)
        const { isValidRefName } = assemblyManager
        const assemblyName = optAssemblyName || assemblyNames[0]

        let parsedLocStrings
        const inputs = locString
          .split(/(\s+)/)
          .map(f => f.trim())
          .filter(f => !!f)

        // first try interpreting as a whitespace-separated sequence of
        // multiple locstrings
        try {
          parsedLocStrings = inputs.map(l =>
            parseLocString(l, ref => isValidRefName(ref, assemblyName)),
          )
        } catch (e) {
          // if this fails, try interpreting as a whitespace-separated refname,
          // start, end if start and end are integer inputs
          const [refName, start, end] = inputs
          if (
            `${e}`.match(/Unknown reference sequence/) &&
            Number.isInteger(+start) &&
            Number.isInteger(+end)
          ) {
            parsedLocStrings = [
              parseLocString(refName + ':' + start + '..' + end, ref =>
                isValidRefName(ref, assemblyName),
              ),
            ]
          } else {
            throw e
          }
        }

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
            throw new Error(`Could not find refName ${refName} in ${asm.name}`)
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

          self.setDisplayedRegions([
            { reversed: loc.reversed, ...loc.parentRegion },
          ])
          const { start, end, parentRegion } = loc

          self.navTo({
            ...loc,
            start: clamp(start ?? 0, 0, parentRegion.end),
            end: clamp(end ?? parentRegion.end, 0, parentRegion.end),
          })
        } else {
          self.setDisplayedRegions(
            // @ts-ignore
            locations.map(r => (r.start === undefined ? r.parentRegion : r)),
          )

          self.showAllRegions()
        }
      },
      moveIfAnchor(leftOffset: BpOffset, rightOffset: BpOffset) {
        if (self.isAnchor) {
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
    .views(self => {
      // @ts-ignore
      const { menuItems: superMenuItems } = self
      return {
        MiniControlsComponent(): React.FC<any> {
          return MiniControls
        },

        HeaderComponent(): React.FC<any> {
          return Header
        },
        menuItems(): MenuItem[] {
          const superMenuItemsArray: MenuItem[] = superMenuItems()

          const index = superMenuItemsArray.findIndex(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (item: any) => item.label === 'Return to import form',
          )

          superMenuItemsArray.splice(index, 1)

          const addRemoveMenuItems = [
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
          ]

          superMenuItemsArray.splice(2, 0, ...addRemoveMenuItems)

          const controlsHideMenuItems: MenuItem[] = [
            {
              label: 'Show controls',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: !self.hideControls,
              onClick: self.toggleControls,
              disabled: !self.isVisible || self.isAnchor || self.isOverview,
            },
            {
              label: 'Hide view',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: !self.isVisible,
              onClick: self.toggleVisible,
              disabled: self.isOverview,
            },
          ]

          superMenuItemsArray.splice(12, 0, ...controlsHideMenuItems)

          return superMenuItemsArray
        },
      }
    })
    .views(self => {
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
    })
}

export type LinearGenomeMultilevelViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearGenomeMultilevelViewModel =
  Instance<LinearGenomeMultilevelViewStateModel>
