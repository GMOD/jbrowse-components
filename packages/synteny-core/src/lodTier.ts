import { getConf } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

/**
 * The user-facing level-of-detail setting on a synteny view or dotplot: 'auto'
 * follows the adapter's bpPerPx threshold, 'fine' pins the per-row CIGAR tier,
 * 'coarse' the tier whose CIGAR is folded to its large indels.
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
 * What a tiered adapter reports about the file it opened, read once per display
 * (`installLodTierInfoFetch`) off `CoreGetInfo`: whether the coarse tier exists
 * at all, and the `--coarse` accuracy bound its `#pif` header states, in bp.
 * `coarseGap` is absent for a file built before the header or with no coarse
 * tier. The indexed PIF adapters' `getHeader` returns this shape.
 */
export interface LodTierInfo {
  hasCoarseTier: boolean
  coarseGap?: number
}

/**
 * Narrow a `CoreGetInfo` result to {@link LodTierInfo}. Anything else — a
 * PAFAdapter's `null`, a VCF's header text — reads as unknown, which
 * {@link resolveLodTier} treats as "trust the config slot".
 */
export function readLodTierInfo(info: unknown): LodTierInfo | undefined {
  const hasCoarseTier =
    typeof info === 'object' &&
    info !== null &&
    'hasCoarseTier' in info &&
    typeof info.hasCoarseTier === 'boolean'
      ? info.hasCoarseTier
      : undefined
  const coarseGap =
    typeof info === 'object' &&
    info !== null &&
    'coarseGap' in info &&
    typeof info.coarseGap === 'number'
      ? info.coarseGap
      : undefined
  return hasCoarseTier === undefined ? undefined : { hasCoarseTier, coarseGap }
}

/**
 * The zoom at which `auto` may switch to the coarse tier, once the file has had
 * its say: undefined for an adapter with no threshold slot and for a file that
 * has no coarse tier; otherwise the slot, raised to the file's `--coarse` bound
 * when the slot is below it. Below the bound the fold's runs lean by more than
 * a pixel, so serving coarse there is wrong output rather than slower output —
 * the clamp is the rule the slot description used to ask the operator to keep
 * by hand.
 *
 * Before the info lands (`tierInfo` undefined) the slot is trusted as-is. That
 * is what keeps the fetch key still when the info arrives for a file built with
 * the defaults, which is nearly every file: the answer was already right, so
 * nothing refetches. Only a file whose header disagrees with the slot moves the
 * key, once.
 */
export function effectiveCoarseThreshold({
  coarseBpPerPxThreshold,
  tierInfo,
}: {
  coarseBpPerPxThreshold: number | undefined
  tierInfo: LodTierInfo | undefined
}) {
  return coarseBpPerPxThreshold === undefined ||
    tierInfo?.hasCoarseTier === false
    ? undefined
    : tierInfo?.coarseGap === undefined
      ? coarseBpPerPxThreshold
      : Math.max(coarseBpPerPxThreshold, tierInfo.coarseGap)
}

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
 * The answer is the tier the adapter will SERVE, not the one the mode asks for:
 * a file with no coarse tier resolves to 'fine' under every mode, pinned
 * 'coarse' included, because that is what `resolveCoarseTier` hands back for
 * it — and a key that said 'coarse' would refetch identical bytes at every
 * threshold crossing. An adapter with no tiering has no threshold slot and
 * resolves to 'fine' at any zoom for the same reason.
 */
export function resolveLodTier({
  bpPerPx,
  coarseBpPerPxThreshold,
  lodMode,
  tierInfo,
}: {
  bpPerPx: number
  coarseBpPerPxThreshold: number | undefined
  lodMode: LodMode
  tierInfo: LodTierInfo | undefined
}): LodTier {
  const threshold = effectiveCoarseThreshold({
    coarseBpPerPxThreshold,
    tierInfo,
  })
  return threshold === undefined
    ? 'fine'
    : lodMode === 'auto'
      ? bpPerPx >= threshold
        ? 'coarse'
        : 'fine'
      : lodMode
}

/**
 * {@link resolveLodTier} over a display's own track threshold and fetched tier
 * info — the spelling the three tiered displays share, so which `bpPerPx` and
 * `lodMode` each feeds it stays the only per-display decision.
 */
export function lodTierAt(
  host: {
    parentTrack: { configuration: AnyConfigurationModel }
    lodTierInfo: LodTierInfo | undefined
  },
  bpPerPx: number,
  lodMode: LodMode,
) {
  return resolveLodTier({
    bpPerPx,
    coarseBpPerPxThreshold: getCoarseBpPerPxThreshold(host.parentTrack),
    lodMode,
    tierInfo: host.lodTierInfo,
  })
}

/**
 * Whether a walk through the served coarse tier's fold is off by more than a
 * pixel: a run stays within `--coarse` bp of the alignment's real path, which
 * is sub-pixel at any zoom at or past the bound and visible below it. Only a
 * pinned 'coarse' reaches that zoom, since `auto` never serves coarse below the
 * bound. The bound is the header's where the file states one, and the slot
 * where it does not.
 */
export function coarseWalkIsApproximate({
  bpPerPx,
  lodTier,
  coarseBpPerPxThreshold,
  tierInfo,
}: {
  bpPerPx: number
  lodTier: LodTier
  coarseBpPerPxThreshold: number | undefined
  tierInfo: LodTierInfo | undefined
}) {
  const bound =
    tierInfo?.coarseGap === undefined
      ? coarseBpPerPxThreshold
      : tierInfo.coarseGap
  return lodTier === 'coarse' && bound !== undefined && bpPerPx < bound
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
 * The wording of the setting. Module-private, and read only by `lodMenuItems`
 * below: a menu row is the one surface that offers this now, so the wording is
 * shared by sharing that builder rather than by every caller spelling its own
 * rows from a table.
 */
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
    // The fallback is named here because the menu cannot avoid offering this:
    // `trackHasLodTiers` tests for the THRESHOLD SLOT, which both indexed PIF
    // adapters declare whether or not the file they open carries the tier. So a
    // file built with `--no-coarse` gets the full submenu and `resolveLodTier`
    // quietly resolves fine once the tier info lands, which is the right
    // behaviour (the alternative is no data) and the wrong thing to say nothing
    // about.
    helpText:
      'Skip base-level detail for speed — only large indels are colored, no ' +
      'mismatches. A ' +
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
