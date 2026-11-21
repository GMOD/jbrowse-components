import { parseFeatureTable, parseRecords } from '@jbrowse/add-track-core'

import { trixLine } from '../util.ts'
import { createReadlineInterface, getLocalOrRemoteStream } from './common.ts'

import type { IndexerOptions } from '../util.ts'

interface Group {
  start: number
  end: number
  values: Set<string>
}

// a GenBank file names no `Name`; its `/label` is what the track labels first
function qualifierFor(attribute: string) {
  return attribute === 'Name' ? 'label' : attribute
}

/**
 * A GenBank file's features as trix records, under the refNames
 * `GenbankAdapter` gives its records. A `gene` and the CDS under it repeat one
 * `/locus_tag`, so a feature is grouped with the others sharing its
 * `/locus_tag`, else with those sharing its `/gene` that it overlaps or abuts,
 * and indexed once over their union: a plastome's two inverted-repeat copies of
 * a gene stay two hits.
 *
 * The file is parsed whole, as the adapter does.
 */
export async function* indexGenbank({
  config,
  attributesToIndex,
  inLocation,
  outDir,
  onStart,
  onUpdate,
  checkAbort,
}: IndexerOptions) {
  const { trackId } = config
  const stream = await getLocalOrRemoteStream({
    file: inLocation,
    out: outDir,
    onStart,
    onUpdate,
  })
  const lines: string[] = []
  for await (const line of createReadlineInterface(stream, inLocation)) {
    checkAbort?.()
    lines.push(line)
  }
  for (const { refName, featureLines } of parseRecords(lines.join('\n'))) {
    const groups = new Map<string, Group[]>()
    for (const { key, location, qualifiers } of parseFeatureTable(
      featureLines,
    )) {
      const positions = (
        location.replaceAll(/[A-Za-z_][\w.]*:/g, '').match(/\d+/g) ?? []
      ).map(Number)
      const values = attributesToIndex.flatMap(
        attribute => qualifiers.get(qualifierFor(attribute)) ?? [],
      )
      if (key !== 'source' && positions.length > 0 && values.length > 0) {
        const start = Math.min(...positions)
        const end = Math.max(...positions)
        const locusTag = qualifiers.get('locus_tag')?.[0]
        const id = locusTag ?? qualifiers.get('gene')?.[0] ?? `${key}:${start}`
        const sharing = groups.get(id) ?? []
        const group = locusTag
          ? sharing[0]
          : sharing.find(g => start <= g.end + 1 && g.start <= end + 1)
        if (group) {
          group.start = Math.min(group.start, start)
          group.end = Math.max(group.end, end)
          for (const value of values) {
            group.values.add(value)
          }
        } else {
          groups.set(id, [...sharing, { start, end, values: new Set(values) }])
        }
      }
    }
    for (const { start, end, values } of [...groups.values()].flat()) {
      yield trixLine(`${refName}:${start}..${end}`, trackId, [...values])
    }
  }
}
