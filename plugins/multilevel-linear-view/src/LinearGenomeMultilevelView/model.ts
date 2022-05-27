import { types, Instance } from 'mobx-state-tree'

import { clamp } from '@jbrowse/core/util'
import { MenuItem } from '@jbrowse/core/ui'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

import { ElementId } from '@jbrowse/core/util/types/mst'
import VisibilityIcon from '@material-ui/icons/Visibility'

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
      }))
      .views(self => {
        // @ts-ignore
        const { menuItems: superMenuItems } = self

        const superMenuItemsArray = superMenuItems()

        const index = superMenuItemsArray.findIndex(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) => item.label === 'Return to import form',
        )
        superMenuItemsArray.splice(index, 1)

        return {
          menuItems(): MenuItem[] {
            return [
              ...superMenuItemsArray,
              { type: 'divider' },
              {
                label: 'Show controls',
                icon: VisibilityIcon,
                type: 'checkbox',
                checked: !self.hideControls,
                onClick: self.toggleControls,
                disabled: !self.isVisible || self.isAnchor,
              },
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
