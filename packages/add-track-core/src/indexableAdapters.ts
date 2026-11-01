export type IndexableFormat = 'gff3' | 'gtf' | 'vcf'

// single source of truth for what `jbrowse text-index` can index: which adapter
// types, where each keeps its file location, and which line parser to use.
// Everything else (the adapter dispatch, the CLI's supported() gate, the
// filename guesser, the add-track form's index offer) derives from this table.
export const indexableAdapters: Record<
  string,
  { locationKey: string; format: IndexableFormat }
> = {
  Gff3Adapter: { locationKey: 'gffLocation', format: 'gff3' },
  Gff3TabixAdapter: { locationKey: 'gffGzLocation', format: 'gff3' },
  GtfAdapter: { locationKey: 'gtfLocation', format: 'gtf' },
  GtfTabixAdapter: { locationKey: 'gtfGzLocation', format: 'gtf' },
  VcfAdapter: { locationKey: 'vcfLocation', format: 'vcf' },
  VcfTabixAdapter: { locationKey: 'vcfGzLocation', format: 'vcf' },
}

export function isSupportedIndexingAdapter(type = '') {
  return type in indexableAdapters
}
