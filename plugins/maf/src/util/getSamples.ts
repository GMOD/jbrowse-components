import { openLocation } from '@jbrowse/core/util/io'
import { parseNewick } from '@jbrowse/tree-sidebar'

import type { MafAdapterOptions, Sample } from '../types.ts'
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
}

export type SampleConfig = string[] | SampleConfigEntry[]

function isStringArray(r: SampleConfig): r is string[] {
  return r.length === 0 || typeof r[0] === 'string'
}

export function normalizeSamples(r: SampleConfig): Sample[] {
  return isStringArray(r)
    ? r.map(id => ({ id, label: id }))
    : r.map(s => ({ id: s.id, label: s.label ?? s.id, color: s.color }))
}

/** Depth-first collection of the leaf (tip) names of a parsed Newick tree. */
export function collectLeafNames(node: NewickNode, acc: string[] = []) {
  if (node.children?.length) {
    for (const child of node.children) {
      collectLeafNames(child, acc)
    }
  } else if (node.name) {
    acc.push(node.name)
  }
  return acc
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
 */
export async function getSamplesFromConfig(getConf: (key: string) => unknown) {
  const nhLoc = getConf('nhLocation')
  const isDefaultPath =
    nhLoc &&
    typeof nhLoc === 'object' &&
    'uri' in nhLoc &&
    nhLoc.uri === '/path/to/my.nh'

  const treeNewick = isDefaultPath
    ? undefined
    : await openLocation(nhLoc as Parameters<typeof openLocation>[0]).readFile(
        'utf8',
      )

  const configSamples = normalizeSamples(getConf('samples') as SampleConfig)

  let samples: Sample[]
  if (treeNewick) {
    const overrides = new Map(configSamples.map(s => [s.id, s]))
    samples = collectLeafNames(parseNewick(treeNewick)).map(
      id => overrides.get(id) ?? { id, label: id },
    )
  } else {
    samples = configSamples
  }

  return { samples, treeNewick }
}
