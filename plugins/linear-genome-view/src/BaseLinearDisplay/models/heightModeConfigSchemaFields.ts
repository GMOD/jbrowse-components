import { types } from '@jbrowse/mobx-state-tree'

import { GROW_MAX_HEIGHT, HEIGHT_MODE_VALUES } from './heightMode.ts'

/**
 * The config slots a display owes `HeightModeMixin` — which strategy, and how
 * tall `grow` is allowed to get.
 *
 * Both are read by the mixin rather than by the display: `heightMode` is its
 * single source of truth (the whole fixed/grow/fit cascade resolves off it) and
 * `growMaxHeight` is the ceiling `grownHeight` caps `growTargetHeight` at. The
 * two displays composing the mixin declared the pair by hand, and what held the
 * copies together was a **value** test on each side — `growMaxHeight defaults
 * to the shared GROW_MAX_HEIGHT` — which pins the number and nothing else. A
 * slot that lost `advanced: true`, or a `heightMode` that lost
 * `promotedBase: 'fixed'` (making `fixed` unpinnable over a promoted `fit`),
 * passes both tests.
 *
 * The **descriptions** are the parameters because they are the part that is
 * genuinely per display — canvas sizes a feature stack against `displayMode`,
 * alignments a grouped pileup against `featureHeight`, and each names its own
 * `maxHeight`, which is a different quantity in the two schemas and therefore
 * deliberately not here. The types, the enum, the promotable sentinel and the
 * grow ceiling are not per display, and both copies had written them out.
 *
 * `growMaxHeight` takes `GROW_MAX_HEIGHT` rather than a literal `800`. Writing
 * the constant used to cost the config docs the number itself — they printed the
 * identifier — which is why both copies spelled it out; the generator resolves a
 * numeric constant now, so the two tests that pinned the value can only fail for
 * a reason worth reading.
 */
export function heightModeConfigSchemaFields({
  heightMode,
  growMaxHeight,
}: {
  /** e.g. "Track-sizing strategy — how the track responds when there are more reads than fit…" */
  heightMode: string
  /** e.g. "Ceiling in pixels for the autogrow track height sizing mode; a pileup deeper than this…" */
  growMaxHeight: string
}) {
  return {
    /**
     * #slot
     */
    heightMode: {
      type: 'maybeStringEnum',
      model: types.enumeration('heightMode', [...HEIGHT_MODE_VALUES]),
      description: heightMode,
      // Promotable sentinel slot (see promotableDefaults.ts): unset is the
      // inherit state, `promotedBase` ('fixed') is what it resolves to when
      // nothing is promoted — so every real mode, `fixed` included, stays
      // customizable back over a session-wide default. Read through the
      // resolved `heightMode` getter (resolveConf), never raw.
      promotedBase: 'fixed',
    },
    /**
     * #slot
     */
    growMaxHeight: {
      type: 'number',
      defaultValue: GROW_MAX_HEIGHT,
      description: growMaxHeight,
      advanced: true,
    },
  } as const
}
