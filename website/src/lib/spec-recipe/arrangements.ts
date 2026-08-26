import {
  SV_CHANNELS_LABEL,
  SV_CHANNELS_ON,
  isSvChannelsActive,
} from '../../../../plugins/alignments/src/LinearAlignmentsDisplay/menus/svChannelsPreset.ts'

import type { SvChannelsSettings } from '../../../../plugins/alignments/src/LinearAlignmentsDisplay/menus/svChannelsPreset.ts'
import type { FieldStep } from './fields.ts'

// An arrangement is a set of display settings one track-menu row applies
// together. `fieldSteps` is one field, one step, so without this pass a figure
// that clicks a single checkbox reads as five instructions spread over four
// menus — the arrangement the row exists to spare the reader, reassembled in
// the docs.
//
// The predicate is the plugin's own, never a copy. Which slots define the
// arrangement and which are framing is the arrangement's definition —
// `isSvChannelsActive` leaves `readConnectionsDown` out because the side the
// arcs hang on is a framing choice — and a second answer here would drift in
// silence, a figure one slot off emitting five steps with nothing to say why.
//
// Presence is this module's half: the predicate answers what the values mean,
// so a spec that omits a slot altogether has to fail before reaching it.
//
// The SECOND member belongs in the plugin, not here. One arrangement does not
// pay for a registry, and this list is the cheapest place to put it while the
// count is one; a second — methylation is the candidate, `colorBy:
// modifications` beside `groupBy: tag HP`, which specs/methylation.ts already
// carries as a `grouped` boolean — makes the vocabulary something the menu and
// the recipes share, and it moves to a UI-free leaf module in
// plugins/alignments the way COMPACTNESS_PRESETS did.
// `menu` is the submenu the row is served from, so an arrangement that moves
// carries its own path rather than every emitted step sharing one guess.
interface Arrangement {
  label: string
  menu: string
  displayType: string
  settings: Record<string, unknown>
  matches: (settings: Record<string, unknown>) => boolean
}

const ARRANGEMENTS: Arrangement[] = [
  {
    label: SV_CHANNELS_LABEL,
    menu: 'Read connections',
    displayType: 'LinearAlignmentsDisplay',
    settings: { ...SV_CHANNELS_ON },
    matches: settings =>
      isSvChannelsActive(settings as unknown as SvChannelsSettings),
  },
]

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)

function holdsEvery(
  settings: Record<string, unknown>,
  required: Record<string, unknown>,
) {
  return Object.keys(required).every(key => key in settings)
}

// The matched arrangement's step, plus the entries left for the per-field walk.
//
// A field the spec spells differently from the arrangement stays behind and
// gets its own step: an entry matching everything but the arc side is still the
// arrangement, and the reader still has to flip that one row by hand.
export function takeArrangement(
  entries: [string, unknown][],
  displayType: string | undefined,
): { step?: FieldStep; rest: [string, unknown][] } {
  const settings = Object.fromEntries(entries)
  const found = ARRANGEMENTS.find(
    a =>
      displayType === a.displayType &&
      holdsEvery(settings, a.settings) &&
      a.matches(settings),
  )
  if (!found) {
    return { rest: entries }
  }
  return {
    step: { path: `Track menu → ${found.menu} → ${found.label}` },
    rest: entries.filter(
      ([field, value]) =>
        !(field in found.settings && same(value, found.settings[field])),
    ),
  }
}
