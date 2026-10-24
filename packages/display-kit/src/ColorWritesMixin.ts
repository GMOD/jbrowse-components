import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { withImpliedField } from '@jbrowse/core/util/colorScale'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import ParkedColorMixin from './ParkedColorMixin.ts'
import {
  colorForField,
  colorForValue,
  impliedFieldOf,
} from './colorConfigSchema.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

/** The whole of what `ColorWritesMixin` needs a composing display to be. */
export interface ColorWritesHost {
  configuration: AnyConfigurationModel & {
    encoding: AnyConfigurationModel & { color: AnyConfigurationModel }
  }
  /** The display's picker for a constant, which Solid color... opens. */
  openSolidColorDialog?: () => void
}

// The mixin's own `self` is the model it declares, so it cannot see the
// `configuration` the concrete display supplies; every display composing it
// has an `encoding.color`, so it is really there. `LegendMixin`'s idiom.
const host = (self: object) => self as ColorWritesHost

/**
 * A color channel as written: each slot its config sets, with the field that
 * paints where the snapshot names none, a `field` slot's default (Hi-C's
 * `observed`) or else the schema's `impliedField` while the channel names no
 * constant either (LGVSyntenyColor's `strand`).
 */
export function writtenColorOf(color: AnyConfigurationModel): ColorSlots {
  const written = getSnapshot<ColorSlots | undefined>(color) ?? {}
  const field: unknown =
    'field' in color ? readConfObject(color, 'field') : undefined
  return typeof field === 'string' && field && written.field === undefined
    ? { ...written, field }
    : withImpliedField(written, impliedFieldOf(color))
}

// The constant `value` holds, painting or kept beside a field; undefined for
// none or a `jexl:` expression.
function solidColorOf({ value }: ColorSlots): string | undefined {
  return typeof value === 'string' && !isJexl(value) ? value : undefined
}

/**
 * #stateModel ColorWritesMixin
 * #category display
 * #crossCuttingMixin The writes a display's `encoding.color` channel takes from a menu row or a picker: the field it paints by (`colorByField`) and the constant every feature paints (`setColorValue`). Each rewrites the object as written, so what a pick leaves alone stays as it was, and a pick of what already paints writes nothing, since every color tier keys on the object's arrays. A pick away from a field parks it (`ParkedColorMixin`), so picking it again keeps its domain, range and key names. A dialog's Apply button writes the whole object through `applyPlot`, which rebuilds the display's config for the draft, too dear for a picker writing once per drag frame
 */
export default function ColorWritesMixin() {
  return types
    .compose('ColorWritesMixin', ParkedColorMixin(), types.model({}))
    .views(self => ({
      /**
       * #getter
       * The `encoding.color` channel as these writes and an Apply button
       * read it, `writtenColorOf`.
       */
      get writtenColor(): ColorSlots {
        return writtenColorOf(host(self).configuration.encoding.color)
      },
    }))
    .actions(self => {
      function write(next: ColorSlots) {
        const written = self.writtenColor
        if (!compareStructural(next, written)) {
          self.parkColor('color', written, next)
          setConf(host(self), ['encoding', 'color'], next)
        }
      }
      return {
        /**
         * #action
         * Paint by `field`, keeping its domain, range and key names while it
         * is the field already painting or the one parked; undefined paints
         * `value` and parks the field.
         */
        colorByField(field: string | undefined) {
          write(colorForField(self.writtenColor, field, self.parkedColor))
        },
        /**
         * #action
         * Paint every feature `value`, a CSS color or a `jexl:` callback,
         * parking the field; undefined lets each feature's own color paint.
         */
        setColorValue(value: string | undefined) {
          write(colorForValue(self.writtenColor, value))
        },
        /**
         * #action
         * Color by's Default: no field and no constant, so the track's own
         * color paints, a `jexl:` expression included.
         */
        pickDefaultColor() {
          if (solidColorOf(self.writtenColor) === undefined) {
            this.colorByField(undefined)
          } else {
            this.setColorValue(undefined)
          }
        },
        /**
         * #action
         * Color by's Solid color...: paints the constant kept beside a
         * painting field, where there is one, and opens the display's picker.
         */
        pickSolidColor() {
          const written = self.writtenColor
          if (written.field && solidColorOf(written) !== undefined) {
            this.colorByField(undefined)
          }
          host(self).openSolidColorDialog?.()
        },
      }
    })
}
