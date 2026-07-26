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

const LOD_MODES: { label: string; value: LodMode; helpText: string }[] = [
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
    helpText:
      'Skip base-level detail for speed — no indel or mismatch coloring.',
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
