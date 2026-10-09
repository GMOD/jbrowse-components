import { setConf } from '@jbrowse/core/configuration'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { colorForField, colorForValue } from './colorConfigSchema.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

/** The whole of what `ColorWritesMixin` needs a composing display to be. */
export interface ColorWritesHost {
  configuration: AnyConfigurationModel & { color: AnyConfigurationModel }
}

// The mixin's own `self` is the model it declares, so it cannot see the
// `configuration` the concrete display supplies; every display composing it
// has a `color` object, so it is really there. `LegendMixin`'s idiom.
const host = (self: object) => self as ColorWritesHost

/** A `color` object as written: each slot its config sets, and no default. */
export function writtenColorOf(color: AnyConfigurationModel): ColorSlots {
  return getSnapshot<ColorSlots | undefined>(color) ?? {}
}

/**
 * #stateModel ColorWritesMixin
 * #category display
 * #crossCuttingMixin The writes a display's `color` object takes from a menu row or a picker: the field it paints by (`colorByField`) and the constant every feature paints (`setColorValue`). Each rewrites the object as written, so what a pick leaves alone stays as it was, and a pick of what already paints writes nothing, since every color tier keys on the object's arrays. A dialog's Apply button writes the whole object through `applyPlot`, which rebuilds the display's config for the draft, too dear for a picker writing once per drag frame
 */
export default function ColorWritesMixin() {
  return types.model('ColorWritesMixin', {}).actions(self => {
    const written = () => writtenColorOf(host(self).configuration.color)
    function write(next: ColorSlots) {
      if (!compareStructural(next, written())) {
        setConf(host(self), 'color', next)
      }
    }
    return {
      /**
       * #action
       * Paint by `field`, keeping its domain, range and key names while it
       * is the field already painting; `''` paints `value` and keeps the
       * field under `scale: 'none'` for the way back.
       */
      colorByField(field: string) {
        write(colorForField(written(), field))
      },
      /**
       * #action
       * Paint every feature `value`, a CSS color or a `jexl:` callback,
       * keeping a field under `scale: 'none'` for the way back; undefined
       * lets each feature's own color paint.
       */
      setColorValue(value: string | undefined) {
        write(colorForValue(written(), value))
      },
    }
  })
}
