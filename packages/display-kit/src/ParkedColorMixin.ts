import { addDisposer, addMiddleware, types } from '@jbrowse/mobx-state-tree'
import { runInAction } from 'mobx'

import { parkedColorOf } from './colorConfigSchema.ts'

import type { ColorSlots } from '@jbrowse/core/util/colorScale'

/**
 * #stateModel ParkedColorMixin
 * #category display
 * #crossCuttingMixin The field the last write took off a color object, with its domain, range and key names, so picking that field again gives them back (`colorForField`). A written field always paints, so the field a write leaves, for Default, Solid color or another field, is display state rather than config. `slot` names the color object and `writtenOf` reads it as written; any action on the model moving its field parks the field it leaves, in that same action, whichever menu, dialog or Edit plot made it. A display with two color objects composes it once for each
 */
export default function ParkedColorMixin<S extends object>(
  slot: string,
  writtenOf: (self: S) => ColorSlots,
) {
  return types
    .model('ParkedColorMixin', {
      /**
       * #property
       * By color object, the field the last write away from one left, with
       * its members
       */
      parkedColors: types.maybe(types.frozen<Record<string, ColorSlots>>()),
    })
    .views(self => ({
      /**
       * #method
       */
      parkedColorOf(name: string): ColorSlots | undefined {
        return self.parkedColors?.[name]
      },
      /**
       * #getter
       * The `color` object's parked field
       */
      get parkedColor(): ColorSlots | undefined {
        return self.parkedColors?.color
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      parkColor(name: string, color: ColorSlots) {
        const parked = parkedColorOf(color)
        if (parked) {
          self.parkedColors = { ...self.parkedColors, [name]: parked }
        }
      },
    }))
    .actions(self => {
      let installed = false
      return {
        afterAttach() {
          // compared across the outermost action, in one batch with it, since
          // MST runs middleware outside the action's own: no observer sees the
          // field gone unparked
          if (installed) {
            return
          }
          installed = true
          let depth = 0
          addDisposer(
            self,
            addMiddleware(
              self,
              (call, next) => {
                if (
                  call.type !== 'action' ||
                  call.context !== self ||
                  call.name.startsWith('@') ||
                  depth > 0
                ) {
                  next(call)
                  return
                }
                runInAction(() => {
                  const before = writtenOf(self as unknown as S)
                  depth++
                  try {
                    next(call)
                  } finally {
                    depth--
                  }
                  if (writtenOf(self as unknown as S).field !== before.field) {
                    self.parkColor(slot, before)
                  }
                })
              },
              false,
            ),
          )
        },
      }
    })
}
