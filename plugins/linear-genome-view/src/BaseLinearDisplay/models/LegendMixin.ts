import { makePin, resolveConf, setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type {
  ConfigModelForFields,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'

// `showLegend` is restated here rather than moved into a shared field table
// because the six composing schemas genuinely disagree about it: `promotedBase`
// is off for a Hi-C color scale and on for a variant genotype key, and each
// description describes a different legend (see the docstring below). Only the
// *type* is common, and typing it is all the cast needs — `ConfigModelForFields`
// has the why. The alternative, `ResolvableDisplay` alone, widens
// `configuration` to `AnyConfigurationModel` and switches the slot-name check
// off entirely.
type LegendConfigModel = ConfigModelForFields<{
  showLegend: { type: 'maybeBoolean'; promotedBase: boolean }
}>

/** The whole of what `LegendMixin` needs a composing display to be. */
export type LegendHost = ResolvableDisplay<LegendConfigModel>

// The mixin's own `self` is the model it declares, so it cannot see the
// `configuration` the concrete display supplies — every display composing this
// is a BaseDisplay, so it is really there. Same idiom, and the same reason, as
// `HeightModeMixin`'s `confNode`.
const confNode = (self: object) => self as LegendHost

/**
 * #stateModel LegendMixin
 * #category display
 * #crossCuttingMixin A legend the user can turn off. A promotable `showLegend` config slot, whose `promotedBase` sets whether this display type's legend is on by default. Brings the resolved `showLegend` getter, the `showLegendDisplayTypeDefault` pin `showLegendCheckboxItem` takes, and `setShowLegend`
 *
 * Six displays carried a character-identical copy of these three members —
 * alignments, Hi-C, multi-row features, multi-wiggle, the multi-sample variant
 * base and the shared LD model — reading and writing one slot name through the
 * promotable cascade. **Both ends of that were already shared**: the track-menu
 * row is `showLegendCheckboxItem` and the thing it shows is `FloatingLegend`,
 * so this was the middle link between two pieces of common code.
 *
 * **The config slot stays per display, and deliberately** — `promotedBase`
 * legitimately differs (a Hi-C color scale is off by default, a variant
 * genotype key on) and each description describes a genuinely different legend.
 * That decision is `showLegendCheckboxItem`'s docstring and this does not
 * disturb it: the slot is what the composing display still supplies, and the
 * mixin only stops it hand-writing the accessors over it.
 *
 * `setShowLegend` is overridable, and one display overrides it: the
 * multi-sample variant base also clears `dismissedLegendSections`, since
 * re-showing the whole legend is what un-dismisses the sections inside it.
 */
export default function LegendMixin() {
  return types
    .model('LegendMixin', {})
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
       * The "make the current legend visibility the default for all tracks"
       * control. Symmetric, so it promotes whichever value the track currently
       * shows. `showLegendCheckboxItem` takes this as its `pin`.
       */
      get showLegendDisplayTypeDefault() {
        return makePin(confNode(self), 'showLegend')
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setShowLegend(arg: boolean) {
        setConf(confNode(self), 'showLegend', arg)
      },
    }))
}
