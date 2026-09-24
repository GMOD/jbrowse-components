import { fetchAndMaybeUnzipText } from './fetchAndMaybeUnzip.ts'
import { getFileName } from './getFileName.ts'
import { openLocation } from './io/index.ts'
import { shorten2 } from './stringUtils.ts'

import type PluginManager from '../PluginManager.ts'
import type { FileLocation } from './types/data.ts'

export type SamplesTsvRow = Record<string, string> & { name: string }

export interface SamplesTsvResult {
  sources: SamplesTsvRow[]
  warnings: string[]
}

export const samplesTsvAdapterConfigSchemaFields = {
  /**
   * #slot
   */
  samplesTsvLocation: {
    type: 'maybeFileLocation',
    description:
      "optional tab-separated table of per-sample metadata. It needs a header row, and its first column is the sample name exactly as the adapter spells it: a VCF sample, a MultiWiggle subtrack's name, a MAF species id. Every other column (`population`, `tissue`, ...) becomes an attribute of that sample, which the multi-row displays group, sort, color and tooltip rows by; a MAF adapter reads the `label`, `color` and `assemblyName` columns onto its species rows, over its `samples` entries. The table also narrows the adapter's samples to the ones it lists, and a table naming none of them is an error. An adapter that lists no samples of its own (a MAF track discovering its species from the file) takes the table's rows as its samples",
  },
} as const

/**
 * The metadata rows for the samples an adapter names, plus the warnings a
 * partial match earns. `names` undefined means the adapter lists no samples of
 * its own, so the rows become the set.
 *
 * A table matching none of `names` throws. Falling back to `names` would show
 * every sample when the config asked for a curated subset, and an empty result
 * draws a blank track with no banner. The message quotes both sides of the
 * mismatch, because a prefix is what separates `1000GP_HG00096` from
 * `HG00096`.
 *
 * `fileLabel` names the file in a message; `namesLabel` names where `names`
 * came from ("the VCF").
 */
export function parseSamplesTsv(
  txt: string,
  names: readonly string[] | undefined,
  fileLabel: string,
  namesLabel: string,
): SamplesTsvResult {
  const lines = txt.split(/\n|\r\n|\r/)
  const header = lines[0]!.split('\t')
  const metadataSet = new Set<string>()
  const duplicates = new Set<string>()
  const metadataLines = lines
    .slice(1)
    .filter(Boolean)
    .map(line => {
      const [name, ...rest] = line.split('\t')
      return {
        ...Object.fromEntries(
          header.slice(1).map((col, idx) => [col, rest[idx] ?? ''] as const),
        ),
        name: name!,
      }
    })
    .filter(row => {
      if (metadataSet.has(row.name)) {
        duplicates.add(row.name)
        return false
      }
      metadataSet.add(row.name)
      return true
    })
  const warnings: string[] = []
  if (duplicates.size) {
    warnings.push(
      `${duplicates.size} samples appear more than once in the metadata file ${fileLabel}; the first row of each is used: ${shorten2([...duplicates].join(','))}`,
    )
  }
  if (!names) {
    return { sources: metadataLines, warnings }
  }
  const nameSet = new Set(names)
  const metadataNotInNames = [...metadataSet].filter(f => !nameSet.has(f))
  const namesNotInMetadata = [...nameSet].filter(f => !metadataSet.has(f))
  const sources = metadataLines.filter(f => nameSet.has(f.name))
  if (sources.length === 0 && names.length > 0) {
    const example = metadataLines[0]?.name
    throw new Error(
      example === undefined
        ? `The samples metadata file ${fileLabel} has a header but no sample rows, so this track has no rows to draw`
        : `No sample in the metadata file ${fileLabel} matches ${namesLabel}, so this track has no rows to draw: its first column reads "${example}" where ${namesLabel} names "${names[0]}". Check for an added prefix or suffix, or for the sample IDs being in a different column.`,
    )
  }
  if (metadataNotInNames.length) {
    warnings.push(
      `${metadataNotInNames.length} of the ${metadataLines.length} samples in the metadata file ${fileLabel} are not in ${namesLabel} (${names.length} samples) and were dropped: ${shorten2(metadataNotInNames.join(','))}`,
    )
  }
  if (namesNotInMetadata.length) {
    warnings.push(
      `${namesNotInMetadata.length} of the ${names.length} samples in ${namesLabel} are not in the metadata file ${fileLabel} (${metadataLines.length} lines) and are not shown: ${shorten2(namesNotInMetadata.join(','))}`,
    )
  }
  return { sources, warnings }
}

/**
 * An adapter's samples merged with its `samplesTsvLocation` table: the bare
 * `names` when the slot is unset, otherwise {@link parseSamplesTsv}'s rows.
 * The warnings come back rather than going to `console.warn`, because this runs
 * in a worker whose console nobody reads.
 */
export async function getSamplesTsvSources({
  location,
  names,
  namesLabel,
  pluginManager,
}: {
  location: FileLocation | undefined
  names: readonly string[] | undefined
  namesLabel: string
  pluginManager?: PluginManager
}): Promise<SamplesTsvResult> {
  if (!location) {
    return { sources: (names ?? []).map(name => ({ name })), warnings: [] }
  }
  const txt = await fetchAndMaybeUnzipText(
    openLocation(location, pluginManager),
  )
  return parseSamplesTsv(
    txt,
    names,
    'uri' in location ? location.uri : getFileName(location),
    namesLabel,
  )
}
