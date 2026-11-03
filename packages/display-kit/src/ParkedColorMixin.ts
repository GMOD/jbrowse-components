import { types } from '@jbrowse/mobx-state-tree'

import { parkedColorOf, parkedIdentityOf } from './colorConfigSchema.ts'

import type { ColorSlots } from '@jbrowse/core/util/colorScale'

const identitySlot = (name: string) => `${name}.identity`

/**
 * #stateModel ParkedColorMixin
 * #category display
 * #crossCuttingMixin The field the last write took off a color object, with its domain, range and key names, so picking that field again gives them back (`colorForField`), and likewise the fieldless identity scale and its key (`colorForIdentity`). A written field always paints, so the field a write leaves, for Default, Solid color or another field, is display state rather than config. Each writer parks before it writes, so no reader sees the field gone unparked
 */
export default function ParkedColorMixin() {
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
      /**
       * #getter
       * The `color` object's parked identity scale and its key
       */
      get parkedIdentity(): ColorSlots | undefined {
        return self.parkedColors?.[identitySlot('color')]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Hold `written`'s field and its members under `name` where `next`, the
       * write about to replace it, names another field; a string `next` is a
       * constant.
       */
      parkColor(name: string, written: ColorSlots, next: unknown) {
        const nextColor: ColorSlots =
          next && typeof next === 'object' ? next : {}
        const parked = parkedColorOf(written)
        if (parked && nextColor.field !== written.field) {
          self.parkedColors = { ...self.parkedColors, [name]: parked }
        }
        const identity = parkedIdentityOf(written)
        if (identity && !parkedIdentityOf(nextColor)) {
          self.parkedColors = {
            ...self.parkedColors,
            [identitySlot(name)]: identity,
          }
        }
      },
    }))
}
