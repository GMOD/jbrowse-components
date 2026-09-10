import { resolveConf, setConf } from '@jbrowse/core/configuration'
import { LEGEND_SVG_GUTTER_WIDTH } from '@jbrowse/core/ui/SvgColorLegend'
import { colorScaleIsEmpty, legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { showLegendCheckboxItem } from '@jbrowse/core/ui/menuItems'
import { types } from '@jbrowse/mobx-state-tree'

import type {
  ConfigModelForFields,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { SettingRowOptions } from '@jbrowse/core/ui/menuItems'

/**
 * The slot this mixin reads, restated rather than moved into a shared field
 * table: the composing schemas disagree about `promotedBase` (off for a Hi-C
 * color scale, on for a variant genotype key) and each describes a different
 * legend. Only the type is common, and typing it is all the cast needs.
 *
 * A runtime value rather than a bare type so `RestatedMixinSlots.test.ts` in
 * jbrowse-web can compare it against the real declarations — a restatement
 * nothing compares to the thing it restates is a copy, and copies drift. The
 * `promotedBase` here is a placeholder; only the key's presence is what makes
 * the type drop the inherit sentinel, and the test checks presence, not value.
 */
export const legendMixinSlots = {
  showLegend: { type: 'maybeBoolean', promotedBase: false },
} as const

// `ResolvableDisplay` alone would widen `configuration` to
// `AnyConfigurationModel` and switch the slot-name check off entirely.
type LegendConfigModel = ConfigModelForFields<typeof legendMixinSlots>

/** The whole of what `LegendMixin` needs a composing display to be. */
export type LegendConfHost = ResolvableDisplay<LegendConfigModel>

// The mixin's own `self` is the model it declares, so it cannot see the
// `configuration` the concrete display supplies — every display composing this
// is a BaseDisplay, so it is really there. Same idiom, and the same reason, as
// `HeightModeMixin`'s `confNode`.
const confNode = (self: object) => self as LegendConfHost

/**
 * #stateModel LegendMixin
 * #category display
 * #crossCuttingMixin The legend, whole. A display declares the color scales it paints with (`colorScales`, a getter hook) and the mixin derives the key from them (`legendSpec`, through `legendSpecOf`), keeps the `showLegend` slot's getter and setter, dismisses sections one at a time (`dismissLegendSection`, undone by re-showing the legend), answers whether there is a key to offer (`hasLegendKey`) and whether the export parks it beside the plot (`svgLegendWidth`). `DisplayChrome` draws the on-screen key and `renderDisplaySvg` the exported one, so a display places neither
 *
 * A key derived from the scales the painter resolves colors through cannot
 * list a color nothing painted, which is what a legend hand-built from a second
 * copy of the rules used to do. The config slot stays per display: the
 * composing schemas set `promotedBase` differently (a Hi-C color scale is off
 * by default, a variant genotype key on) and describe different legends, so
 * this mixin supplies the accessors over the slot and never the slot.
 */
export default function LegendMixin() {
  return types
    .model('LegendMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * Ids of the scales whose section the reader closed on its own; cleared
       * when the whole legend is shown again. Volatile where `showLegend` is
       * config: which sections a reader collapsed in one sitting is not how
       * the track is configured.
       */
      dismissedLegendSections: [] as string[],
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the legend is drawn. Resolved through the promotable-slot tiers
       * (`resolveConf`): an explicit track value customizes it either way,
       * otherwise it follows the session-wide default for this display type,
       * falling back to the slot's `promotedBase`.
       */
      get showLegend(): boolean {
        return resolveConf(confNode(self), 'showLegend')
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
       * Overridable hook (default 0): px the key is pushed down from its own
       * inset, on screen and in the export alike. A display that already draws
       * something of its own in that corner — Hi-C's resolution box — answers
       * that thing's height; the chrome adds its own axis captions on top.
       */
      get legendTop(): number {
        return 0
      },
      /**
       * #method
       * Overridable hook (default 0): the width the LGV export reserves beside
       * the plot for this legend. A display whose plot fills its band — the
       * contact matrix, the LD triangle — answers `svgLegendGutterWidth(self)`
       * so the key does not cover it.
       */
      svgLegendWidth(): number {
        return 0
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
        return legendSpecOf(
          self.colorScales.filter(
            scale => !self.dismissedLegendSections.includes(scale.id),
          ),
        )
      },
      /**
       * #getter
       * Whether the display has a key at all, which is what the "Show legend"
       * row is offered on. Overridable for a display whose key is only waiting
       * for data: a scale that fills in once a region lands must not take the
       * way back to the toggle with it.
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
        setConf(confNode(self), 'showLegend', arg)
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
 * The `svgLegendWidth()` a display whose plot fills its band answers with.
 * Deliberately NOT gated on whether there is legend data: SVGLinearGenomeView
 * maxes this across tracks *before* awaiting each `renderSvg`, so on a headless
 * export (jbrowse-img — the fetch is a debounced autorun) the data has not
 * landed yet and a data-dependent answer reserved nothing, leaving the legend
 * to float over the matrix. Reserving on the setting alone costs an unused
 * strip only when the track loads empty or errors.
 */
export function svgLegendGutterWidth(self: { showLegend: boolean }) {
  return self.showLegend ? LEGEND_SVG_GUTTER_WIDTH : 0
}

/**
 * The "Show legend" checkbox for a display composing `LegendMixin`: the slot
 * and the toggle, so a track menu lists it in one call. `opts` is for a display
 * that greys the row out under a scheme with no key, which keeps the row in the
 * menu whatever the scheme.
 */
export function legendCheckboxItem(
  self: {
    showLegend: boolean
    setShowLegend: (arg: boolean) => void
  },
  opts?: SettingRowOptions,
) {
  return showLegendCheckboxItem(
    self.showLegend,
    () => {
      self.setShowLegend(!self.showLegend)
    },
    opts,
  )
}
