export const SORT_BED_DESCRIPTION =
  'Helper utility to sort BED files for tabix. Moves all lines starting with # to the top of the file, and sort by refname and start position using unix utilities sort and grep'

export const SORT_BED_EXAMPLES = [
  '# sort bed and pipe to bgzip',
  '$ jbrowse sort-bed input.bed | bgzip > sorted.bed.gz',
  '$ tabix sorted.bed.gz',
]

export const REQUIRED_COMMANDS = ['sh', 'sort', 'grep'] as const