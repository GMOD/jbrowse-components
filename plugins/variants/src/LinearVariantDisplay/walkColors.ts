import { viewDisplays } from '@jbrowse/core/util/viewDisplays'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { computed } from 'mobx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The color a graph display draws one haplotype walk in, as it publishes it
 * in `haplotypeColors`: PanSN's `sample`, and `haplotype` counting from 1
 * where a VCF's phase index counts from 0, absent for a walk named by its
 * bare sample. Plugin ABI: reference/PLUGIN_ABI_STABILITY.md.
 */
export interface HaplotypeColor {
  sample: string
  haplotype?: number
  color: string
}

/** One display's published colors, by sample. */
export type WalkColors = ReadonlyMap<string, readonly HaplotypeColor[]>

function isHaplotypeColors(value: unknown): value is readonly HaplotypeColor[] {
  return Array.isArray(value)
}

function publishedColors(display: unknown): readonly HaplotypeColor[] {
  return typeof display === 'object' &&
    display !== null &&
    'haplotypeColors' in display &&
    isHaplotypeColors(display.haplotypeColors)
    ? display.haplotypeColors
    : []
}

function bySample(published: readonly HaplotypeColor[]): WalkColors {
  const grouped = new Map<string, HaplotypeColor[]>()
  for (const walk of published) {
    const ofSample = grouped.get(walk.sample)
    if (ofSample) {
      ofSample.push(walk)
    } else {
      grouped.set(walk.sample, [walk])
    }
  }
  return grouped
}

/**
 * A row's walk color in one display: a haplotype row takes its own
 * haplotype's walk, else a walk named by its bare sample, as hover sync
 * falls back to the sample; a sample row takes its sample's color where
 * every walk of the sample shares one.
 */
function walkColorOf(
  walks: WalkColors,
  row: { sampleName: string; HP?: number },
) {
  const ofSample = walks.get(row.sampleName) ?? []
  const { HP } = row
  return HP === undefined
    ? new Set(ofSample.map(walk => walk.color)).size === 1
      ? ofSample[0]?.color
      : undefined
    : (
        ofSample.find(walk => walk.haplotype === HP + 1) ??
        ofSample.find(walk => walk.haplotype === undefined)
      )?.color
}

/**
 * `rows` each with its walk's color as its own `color` where it has none,
 * from the first display in track order that matches it.
 */
export function withWalkColors<
  R extends { sampleName: string; HP?: number; color?: string },
>(rows: R[], displays: readonly WalkColors[]): R[] {
  return displays.length === 0
    ? rows
    : rows.map(row => {
        const color =
          row.color === undefined
            ? displays.reduce<string | undefined>(
                (found, walks) => found ?? walkColorOf(walks, row),
                undefined,
              )
            : undefined
        return color === undefined ? row : { ...row, color }
      })
}

/**
 * The walk colors the other displays in `self`'s view publish, one entry
 * per publishing display in track order, regrouped only when what they
 * publish changes. None in no view, so a static export's rows keep only
 * their own colors.
 */
export function variantWalkColorViews(self: IAnyStateTreeNode) {
  const published = stableIdentityComputed(() =>
    viewDisplays(self)
      .filter(display => display !== self)
      .map(publishedColors)
      .filter(colors => colors.length > 0),
  )
  const grouped = computed(() => published.get().map(bySample))
  return {
    /**
     * #getter
     * The haplotype walk colors each graph track in the view publishes, by
     * sample, which a row with no color of its own takes, so its label bar
     * matches its walk.
     */
    get walkColors(): readonly WalkColors[] {
      return grouped.get()
    },
  }
}
