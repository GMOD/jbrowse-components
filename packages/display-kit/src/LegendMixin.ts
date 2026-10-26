import { getConf, setConf } from '@jbrowse/core/configuration'
import { colorScaleIsEmpty, legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { types } from '@jbrowse/mobx-state-tree'

import type { legendConfigSchema } from './legendConfigSchema.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * The whole of what `LegendMixin` needs a composing display to be: a `legend`
 * declared as `legendConfigSchema` or `hiddenLegendConfigSchema`.
 */
export interface LegendConfHost {
  configuration: ConfigModelForFields<{ legend: typeof legendConfigSchema }>
}

// The mixin's own `self` is the model it declares, so it cannot see the
// `configuration` the concrete display supplies — every display composing this
// is a BaseDisplay, so it is really there. Same idiom, and the same reason, as
// `HeightModeMixin`'s `confNode`.
const confNode = (self: object) => self as LegendConfHost

function shownLegendSpec(scales: ColorScale[], dismissed: string[]) {
  return legendSpecOf(scales.filter(scale => !dismissed.includes(scale.id)))
}

/**
 * #stateModel LegendMixin
 * #category display
 * #crossCuttingMixin The legend, whole. A display declares the color scales it paints with (`colorScales`, a getter hook, and `colorScalesIn` where they follow the theme) and the mixin derives the key from them (`legendSpec`, and `legendSpecIn` for the SVG export, through `legendSpecOf`), keeps the `legend.show` slot's getter and setter (`showLegend`, `setShowLegend`), dismisses sections one at a time (`dismissLegendSection`, undone by re-showing the legend), and answers whether there is a key to offer (`hasLegendKey`). `DisplayChrome` draws the on-screen key and the exporting view the exported one, in a gutter right of the plot, so a display places neither
 *
 * A key derived from the scales the painter resolves colors through lists only
 * colors that were painted. A legend hand-built from a second copy of the rules
 * can list a color nothing painted. Each display declares the `legend` slot,
 * `legendConfigSchema` or `hiddenLegendConfigSchema` by its default, so this
 * mixin supplies the accessors over it and never the slot.
 */
export default function LegendMixin() {
  return types
    .model('LegendMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * Ids of the scales whose section the reader closed; cleared
       * when the whole legend is shown again. Volatile where `legend.show` is
       * config: which sections a reader collapsed in one sitting is not how
       * the track is configured.
       */
      dismissedLegendSections: [] as string[],
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the legend is drawn.
       */
      get showLegend(): boolean {
        return getConf(confNode(self), ['legend', 'show'])
      },
      /**
       * #getter
       * Overridable hook (default none): the color scales this display paints
       * with, in the order the key lists them. Each becomes one section of the
       * legend, so a display with two vocabularies (genotype colors and sample
       * groups) declares two.
       */
      get colorScales(): ColorScale[] {
        return []
      },
      /**
       * #getter
       * Overridable hook (default 0): px the on-screen key is pushed left from
       * the key's inset, for a display that draws a column of text down its
       * right edge — the multi-way lanes' scales. Not read by the export.
       */
      get legendRight(): number {
        return 0
      },
    }))
    .views(self => ({
      /**
       * #method
       * Overridable hook (default `colorScales`): the scales in another theme,
       * the SVG export's, which need not be the session's. Only a display
       * whose key takes colors from the theme answers it.
       */
      colorScalesIn(_palette: JBrowsePalette): ColorScale[] {
        return self.colorScales
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The key, derived from `colorScales` less the sections the reader
       * dismissed. `DisplayChrome` renders it on screen and `renderDisplaySvg`
       * flattens it for the export, so the two describe one set of colors.
       */
      get legendSpec(): LegendSpec {
        return shownLegendSpec(self.colorScales, self.dismissedLegendSections)
      },
      /**
       * #method
       * `legendSpec` in the SVG export's theme.
       */
      legendSpecIn(palette: JBrowsePalette): LegendSpec {
        return shownLegendSpec(
          self.colorScalesIn(palette),
          self.dismissedLegendSections,
        )
      },
      /**
       * #getter
       * Whether the display has a key at all. The "Legend" row is offered
       * only when it does. Overridable for a display whose key is only waiting
       * for data: a scale that stays empty until a region lands must not remove
       * the toggle in the meantime.
       */
      get hasLegendKey(): boolean {
        return self.colorScales.some(scale => !colorScaleIsEmpty(scale))
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Writes the slot, and showing the legend again restores the sections
       * closed inside it.
       */
      setShowLegend(arg: boolean) {
        setConf(confNode(self), ['legend', 'show'], arg)
        if (arg) {
          self.dismissedLegendSections = []
        }
      },
      /**
       * #action
       * Close one section of the legend, leaving the others up.
       */
      dismissLegendSection(id: string) {
        self.dismissedLegendSections = [...self.dismissedLegendSections, id]
      },
    }))
}

/**
 * The "Legend" row of a display's "Show" submenu, for a display composing
 * `LegendMixin`. A display with no key to show (`hasLegendKey`) leaves the row
 * out, and every display lists it last.
 */
export function legendCheckboxItem(self: {
  showLegend: boolean
  setShowLegend: (arg: boolean) => void
}) {
  return toggleItem('Legend', self.showLegend, self.setShowLegend)
}
