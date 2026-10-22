import { types } from '@jbrowse/mobx-state-tree'

import { parkedColorOf } from './colorConfigSchema.ts'

import type { ColorSlots } from '@jbrowse/core/util/colorScale'

/**
 * #stateModel ParkedColorMixin
 * #category display
 * #crossCuttingMixin The field the last write took off a color object, with its domain, range and key names, so picking that field again gives them back (`colorForField`). A written field always paints, so the field a write leaves, for Default, Solid color or another field, is display state rather than config. Each writer parks before it writes, so no reader sees the field gone unparked
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
    }))
    .actions(self => ({
      /**
       * #action
       * Hold `written`'s field and its members under `name` where `next`, the
       * write about to replace it, names another field; a string `next` is a
       * constant.
       */
      parkColor(name: string, written: ColorSlots, next: unknown) {
        const nextField =
          next && typeof next === 'object' && 'field' in next
            ? next.field
            : undefined
        const parked = parkedColorOf(written)
        if (parked && nextField !== written.field) {
          self.parkedColors = { ...self.parkedColors, [name]: parked }
        }
      },
    }))
}
