import { getConf } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

/**
 * The user-facing level-of-detail setting on a synteny view or dotplot: 'auto'
 * follows the adapter's bpPerPx threshold, 'fine' pins the per-row CIGAR tier,
 * 'coarse' the no-CIGAR tier.
 */
export type LodMode = 'auto' | 'fine' | 'coarse'

/**
 * The tier a fetch asks the adapter for — deliberately a narrower type than
 * {@link LodMode}. 'auto' is a *preference*, and an adapter is never handed one:
 * resolving it needs a zoom, and the zoom lives on the main thread where the
 * refetch key is computed. Keeping the two as separate types is what stops the
 * resolution from drifting back into the adapter (see {@link resolveLodTier}).
 */
export type LodTier = 'fine' | 'coarse'

/**
 * The one place `auto` becomes a tier.
 *
 * This *must* run on the main thread, in a display getter that feeds the fetch
 * cache key, because the tier is a fetch input: resolve it adapter-side from
 * `bpPerPx` and the key no longer knows the tier changed. That was a real bug —
 * `LinearSyntenyDisplay` keys refetches on a log2 zoom bucket, and the default
 * 10000 threshold sits inside bucket 13 (8192..16384), so zooming across the
 * threshold left the view holding the wrong tier's data while reporting itself
 * current.
 *
 * Resolving here rather than forwarding `bpPerPx` into the fetch key is equally
 * deliberate: a raw `bpPerPx` in the key would invalidate every fetch on every
 * zoom step. The tier changes only when it flips.
 *
 * An adapter with no tiering has no threshold slot, and only the fine tier to
 * serve, so it resolves to 'fine' at any zoom.
 */
export function resolveLodTier({
  bpPerPx,
  coarseBpPerPxThreshold,
  lodMode,
}: {
  bpPerPx: number
  coarseBpPerPxThreshold: number | undefined
  lodMode: LodMode
}): LodTier {
  return lodMode === 'auto'
    ? coarseBpPerPxThreshold !== undefined && bpPerPx >= coarseBpPerPxThreshold
      ? 'coarse'
      : 'fine'
    : lodMode
}

/**
 * The zoom at which a track's adapter switches tiers in `auto`, or undefined for
 * an adapter with no tiering.
 *
 * Read via the slot path rather than off a display's `adapterConfig`, which is a
 * snapshot and so carries only explicitly-set keys — the threshold read
 * undefined for every track that leaves it at its default, which is nearly all
 * of them, and the tier was never resolved.
 */
export function getCoarseBpPerPxThreshold(track: {
  configuration: AnyConfigurationModel
}) {
  const threshold: unknown = getConf(track, [
    'adapter',
    'coarseBpPerPxThreshold',
  ])
  return typeof threshold === 'number' ? threshold : undefined
}

/**
 * #api
 * The slice of a track model a comparative view reads off its track list.
 *
 * Annotated at every site that walks a synteny view's `levels[].tracks` or a
 * dotplot's `tracks`, because those arrays type out as `any`: the level model is
 * deliberately `IAnyModelType` to break a real type cycle, and `any` propagates
 * through the array and switches off checking on everything read from it. That
 * is not theoretical — it let `getConf(t.configuration, ...)` compile where
 * getConf wants the MODEL, and it threw at runtime reading
 * `configuration.configuration.adapter`. Naming the shape is what makes the
 * compiler check those calls again.
 */
export interface ComparativeTrackModel {
  configuration: AnyConfigurationModel & { trackId: string; name: string }
}

/**
 * Whether a track's adapter offers level-of-detail tiers to switch between —
 * PAFAdapter and BlastTabularAdapter do not.
 *
 * Tested by the presence of the threshold slot rather than by a separate `'lod'`
 * adapter capability, so there is one signal instead of two that can disagree:
 * the display cannot resolve a tier without the threshold, so a capability flag
 * on an adapter missing the slot would offer a menu whose 'auto' never switches.
 */
export function trackHasLodTiers(track: {
  configuration: AnyConfigurationModel
}) {
  return getCoarseBpPerPxThreshold(track) !== undefined
}

/**
 * The wording of the setting, shared by the surfaces that offer it in a menu
 * (`lodMenuItems`) and the ones that offer it as a settings-panel row, so a
 * reader moving between a synteny view, a dotplot and an LGV synteny track
 * cannot be shown three names for one thing.
 */
export const LOD_MODES: { label: string; value: LodMode; helpText: string }[] =
  [
    {
      label: 'Automatic (by zoom)',
      value: 'auto',
      helpText:
        'Show base-level detail when zoomed in, blocks-only when zoomed out.',
    },
    {
      label: 'Indels + mismatches',
      value: 'fine',
      helpText:
        'Always load base-level indel/mismatch detail. Slower when zoomed far out.',
    },
    {
      label: 'Alignment blocks only',
      value: 'coarse',
      // The fallback is named here because the menu cannot avoid offering this:
      // `trackHasLodTiers` tests for the THRESHOLD SLOT, which both indexed PIF
      // adapters declare whether or not the file they open carries the tier —
      // whether it does is `PifFile.hasCoarseTier`, an async question on the
      // adapter side of the RPC. So a file built with `--no-coarse` gets the full
      // submenu and `resolveCoarseTier` quietly serves fine, which is the right
      // behaviour (the alternative is no data) and the wrong thing to say nothing
      // about.
      helpText:
        'Skip base-level detail for speed — no indel or mismatch coloring. A ' +
        'file built without the coarse tier (make-pif --no-coarse) has nothing ' +
        'to switch to and keeps serving full detail.',
    },
  ]

/**
 * The "Level of detail" radio submenu, shared by every surface that draws a
 * tiered synteny track (synteny view, dotplot, LGV synteny display) so the three
 * cannot offer different wording for the same setting. Returns [] when nothing on
 * the surface has tiered storage — PAFAdapter and BlastTabularAdapter have
 * nothing to switch between.
 */
export function lodMenuItems(model: {
  hasLodCapableAdapter: boolean
  lodMode: LodMode
  setLodMode: (arg: LodMode) => void
}): MenuItem[] {
  return model.hasLodCapableAdapter
    ? [
        {
          label: 'Level of detail',
          // The row says what the setting IS; each option says what it does.
          // Without it the group is the one submenu in a settings menu with no
          // "?" at all, and a reader has to open it to learn what a tier is.
          helpText:
            'Which stored tier of the alignment file is fetched. A tiered file ' +
            'carries a coarse copy with no base-level detail, which draws far ' +
            'faster when zoomed out.',
          subMenu: LOD_MODES.map(({ label, value, helpText }) => ({
            helpText,
            label,
            type: 'radio' as const,
            checked: model.lodMode === value,
            onClick: () => {
              model.setLodMode(value)
            },
          })),
        },
      ]
    : []
}
