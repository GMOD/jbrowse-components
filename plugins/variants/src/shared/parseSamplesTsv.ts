import { shorten2 } from '@jbrowse/core/util'

export interface SamplesTsvResult {
  sources: (Record<string, string> & { name: string })[]
  warnings: string[]
}

/**
 * The metadata rows for the samples the VCF header actually names, plus the
 * warnings a partial match earns. The caller reports the warnings — they used to
 * go to `console.warn` in the worker, where nobody sees them.
 *
 * A file matching NONE of the VCF's samples throws instead. It is a config
 * error, and the alternative was silence: the filter empties, so `getVcfSources`
 * returns `[]`, so `sourcesBase` is `[]` — which is truthy, so no loading state
 * shows either — so `sampleFilter` is `[]`, which `buildCanonicalRows` correctly
 * reads as "no samples", and the display draws an empty band with no banner.
 * Falling back to `parser.samples` would be the worse failure: a track quietly
 * showing every sample when the config asked for a curated subset.
 *
 * The message carries an example of the mismatch because that is the whole
 * diagnosis — what separates `1000GP_HG00096` from `HG00096` is a prefix, and no
 * count of unmatched rows tells you that.
 */
export function parseSamplesTsv(
  txt: string,
  vcfSamples: string[],
  // What to call the file in a message: its uri, or its bare name for a
  // localPath/blob location.
  fileLabel: string,
): SamplesTsvResult {
  const lines = txt.split(/\n|\r\n|\r/)
  const header = lines[0]!.split('\t')
  const vcfSampleSet = new Set(vcfSamples)
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
  const metadataSet = new Set(metadataLines.map(r => r.name))
  const metadataNotInVcf = [...metadataSet].filter(f => !vcfSampleSet.has(f))
  const vcfNotInMetadata = [...vcfSampleSet].filter(f => !metadataSet.has(f))
  const sources = metadataLines.filter(f => vcfSampleSet.has(f.name))
  if (sources.length === 0 && vcfSamples.length > 0) {
    const example = metadataLines[0]?.name
    throw new Error(
      example === undefined
        ? `The samples metadata file ${fileLabel} has a header but no sample rows, so this track has no rows to draw`
        : `No sample in the metadata file ${fileLabel} matches the VCF header, so this track has no rows to draw: its first column reads "${example}" where the VCF names "${vcfSamples[0]}". Check for an added prefix or suffix, or for the sample IDs being in a different column.`,
    )
  }
  const warnings: string[] = []
  if (metadataNotInVcf.length) {
    warnings.push(
      `${metadataNotInVcf.length} of the ${metadataLines.length} samples in the metadata file ${fileLabel} are not in the VCF (${vcfSamples.length} samples) and were dropped: ${shorten2(metadataNotInVcf.join(','))}`,
    )
  }
  if (vcfNotInMetadata.length) {
    warnings.push(
      `${vcfNotInMetadata.length} of the ${vcfSamples.length} samples in the VCF are not in the metadata file ${fileLabel} (${metadataLines.length} lines) and are not shown: ${shorten2(vcfNotInMetadata.join(','))}`,
    )
  }
  return { sources, warnings }
}
