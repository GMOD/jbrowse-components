import { openLocation } from '@jbrowse/core/util/io'
import { parseNewick } from '@jbrowse/tree-sidebar'

import type { MafAdapterOptions, Sample } from '../types.ts'
import type { FileLocation, UriLocation } from '@jbrowse/core/util'
import type { NewickNode } from '@jbrowse/tree-sidebar'

/** Sample-id set shared by all three adapters to resolve tokens — see `matchSampleId`. */
export function buildSampleFilter(
  opts?: MafAdapterOptions,
): Set<string> | undefined {
  return opts?.samples ? new Set(opts.samples.map(s => s.id)) : undefined
}

interface SampleConfigEntry {
  id: string
  label?: string
  color?: string
  assemblyName?: string
  assemblyConfigLocation?: UriLocation
}

export type SampleConfig = string[] | SampleConfigEntry[]

function isStringArray(r: SampleConfig): r is string[] {
  return r.length === 0 || typeof r[0] === 'string'
}

/**
 * Sample ids are matched against the file's source tokens character for
 * character (`matchSampleId`), so a stray space is a total mismatch that looks
 * like a correct config — and these come from a hand-written JSON array or a
 * pasted-in list. Trimmed at the source rather than at the comparison so the id
 * the sidebar labels a row with, the id `rowIndexBySrc` keys on and the id the
 * adapter matches are all the same string.
 */
function trimId(id: string) {
  return id.trim()
}

export function normalizeSamples(r: SampleConfig): Sample[] {
  return isStringArray(r)
    ? r.map(id => ({ id: trimId(id), label: trimId(id) }))
    : r.map(s => ({
        id: trimId(s.id),
        label: s.label ?? trimId(s.id),
        color: s.color,
        ...(s.assemblyName ? { assemblyName: s.assemblyName } : {}),
        ...(s.assemblyConfigLocation
          ? { assemblyConfigLocation: s.assemblyConfigLocation }
          : {}),
      }))
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
  const isDefaultPath =
    'uri' in nhLocation && nhLocation.uri === '/path/to/my.nh'

  const treeNewick = isDefaultPath
    ? undefined
    : await openLocation(nhLocation).readFile('utf8')

  const configSamples = normalizeSamples(samplesConfig)
  const samples = treeNewick
    ? resolveSamplesFromTree(treeNewick, configSamples)
    : configSamples

  return { samples, treeNewick }
}
