import { shorten2 } from '@jbrowse/core/util'

export function parseSamplesTsv(txt: string, vcfSamples: string[]) {
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
          header.slice(1).map((col, idx) => [col, rest[idx] || ''] as const),
        ),
        name: name!,
      }
    })
  const metadataSet = new Set(metadataLines.map(r => r.name))
  const metadataNotInVcf = [...metadataSet].filter(f => !vcfSampleSet.has(f))
  const vcfNotInMetadata = [...vcfSampleSet].filter(f => !metadataSet.has(f))
  if (metadataNotInVcf.length) {
    console.warn(
      `There are ${metadataNotInVcf.length} samples in metadata file (${metadataLines.length} lines) not in VCF (${vcfSamples.length} samples):`,
      shorten2(metadataNotInVcf.join(',')),
    )
  }
  if (vcfNotInMetadata.length) {
    console.warn(
      `There are ${vcfNotInMetadata.length} samples in VCF file (${vcfSamples.length} samples) not in metadata file (${metadataLines.length} lines):`,
      shorten2(vcfNotInMetadata.join(',')),
    )
  }
  return metadataLines.filter(f => vcfSampleSet.has(f.name))
}
