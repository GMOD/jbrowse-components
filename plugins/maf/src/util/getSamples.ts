import { openLocation } from '@jbrowse/core/util/io'
import { parseNewick } from '@jbrowse/tree-sidebar'

import { navigationFields } from './navigationFields.ts'
import { isUnconfiguredNhLocation } from './nhLocation.ts'

import type { MafAdapterOptions, Sample } from '../types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FileLocation, UriLocation } from '@jbrowse/core/util'
import type { NewickNode } from '@jbrowse/tree-sidebar'

/** Sample-id set shared by all three adapters to resolve tokens — see `matchSampleId`. */
export function buildSampleFilter(
  opts?: MafAdapterOptions,
): Set<string> | undefined {
  return opts?.samples ? new Set(opts.samples.map(s => s.id)) : undefined
}

export interface SampleConfigEntry {
  id: string
  label?: string
  color?: string
  assemblyName?: string
  assemblyConfigLocation?: UriLocation
}

export type SampleConfig = (string | SampleConfigEntry)[]

/**
 * The `samples` slot as rows.
 *
 * Each entry is read on its own — a bare name or an object — so an array may
 * mix the two. It used to be typed off element 0, which read
 * `["hg38", {"id": "mm10"}]` as two objects and gave the second row an
 * `undefined` id.
 *
 * Ids are trimmed here rather than at the comparison, because they are matched
 * against the file's source tokens character for character (`matchSampleId`):
 * a stray space is a total mismatch that looks like a correct config, and these
 * come from a hand-written JSON array or a pasted-in list. One trim means the
 * id the sidebar labels a row with, the id `rowIndexBySrc` keys on and the id
 * the adapter matches are the same string.
 *
 * An entry naming nothing is dropped rather than becoming a nameless row — it
 * used to throw out of sample resolution, which fails the whole track.
 */
export function normalizeSamples(r: SampleConfig): Sample[] {
  return r.flatMap(s => {
    // `Partial`, because `samples` is a frozen slot: nothing has checked that
    // an object entry carries an id at all, and the declared `string` is the
    // contract rather than a fact about the config that was loaded.
    const entry: Partial<SampleConfigEntry> =
      typeof s === 'string' ? { id: s } : s
    const id = entry.id?.trim()
    return id
      ? [
          {
            id,
            label: entry.label ?? id,
            color: entry.color,
            ...navigationFields(entry),
          },
        ]
      : []
  })
}

/**
 * Depth-first collection of the leaf (tip) names of a parsed Newick tree, in
 * left-to-right order — which is row order, so the traversal order is the
 * contract and not an implementation detail.
 *
 * Trimmed for the same reason config ids are: a leaf name is a sample id, and a
 * `.nh` written with a space after a comma carries it into the name, where it
 * matches no source token in the file.
 *
 * Iterative because the depth of a tree is not something a guide tree promises
 * to bound: recursion here threw RangeError past a few thousand tips, and it
 * threw during sample resolution, so it failed the whole track rather than one
 * drawing pass. Children are pushed in reverse so they pop left-first.
 */
export function collectLeafNames(node: NewickNode) {
  const acc: string[] = []
  const stack = [node]
  while (stack.length > 0) {
    const n = stack.pop()!
    if (n.children?.length) {
      for (let i = n.children.length - 1; i >= 0; i--) {
        stack.push(n.children[i]!)
      }
    } else if (n.name?.trim()) {
      acc.push(n.name.trim())
    }
  }
  return acc
}

/**
 * Merge a parsed Newick tree with per-sample config overrides. Leaf order
 * drives row order; `configSamples` supplies label/color for matching ids.
 * Leaves with no override get `{ id, label: id }`.
 */
export function resolveSamplesFromTree(
  treeNewick: string,
  configSamples: Sample[],
): Sample[] {
  const overrides = new Map(configSamples.map(s => [s.id, s]))
  return collectLeafNames(parseNewick(treeNewick)).map(
    id => overrides.get(id) ?? { id, label: id },
  )
}

/**
 * Resolve a track's sample set + guide tree. The sample set fixes which
 * genomes get a row, the row order, and how source tokens are split (via
 * `matchSampleId`). Resolution:
 * - With a tree: its leaf names are the set + order (so the sidebar tree lines
 *   up with the rows); any `samples` config supplies label/color overrides,
 *   matched by id.
 * - Without a tree: the `samples` config is the set, in its listed order.
 * - With neither: empty — the caller discovers the genomes from the data.
 *
 * Tree/config names carry the haplotype suffix (`Species1.1`) that
 * `matchSampleId` resolves exactly.
 *
 * Each adapter holds this in a `cachedSetup` as its `getSamples` field, because
 * every alignment and summary RPC opens with `loadMafSamplesAdapter` — which
 * calls `getSamples()` — and `openLocation` builds a fresh `RemoteFile` each
 * time, so an uncached read re-downloads and re-parses the Newick tree once per
 * region per navigation. The set is config-derived and cannot change without a
 * new adapter, so one read per adapter is all it can ever need.
 */
export async function getSamplesFromConfig(
  nhLocation: FileLocation,
  samplesConfig: SampleConfig,
) {
  const treeNewick = isUnconfiguredNhLocation(nhLocation)
    ? undefined
    : await openLocation(nhLocation).readFile('utf8')

  const configSamples = normalizeSamples(samplesConfig)
  const samples = treeNewick
    ? resolveSamplesFromTree(treeNewick, configSamples)
    : configSamples

  return { samples, treeNewick }
}

/**
 * {@link getSamplesFromConfig} against an adapter's own slots — what
 * `MafAdapterBase` holds in `getSamples`. A function rather than inline in that
 * class for the reason `ComparativeAdapterBase` hoists no config read at all: a
 * base generic over its config cannot prove a slot name to `getConf`, while a
 * plain `BaseFeatureDataAdapter` parameter resolves them against
 * `AnyConfigurationModel` — how `loadMafSummaryAdapter` already reads
 * `summaryAdapter` for the same four.
 */
export function getSamplesFromAdapter(self: BaseFeatureDataAdapter) {
  return getSamplesFromConfig(
    self.getConf('nhLocation'),
    self.getConf('samples'),
  )
}
