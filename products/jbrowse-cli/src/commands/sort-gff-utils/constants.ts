export const SORT_GFF_DESCRIPTION =
  'Helper utility to sort GFF files for tabix. Moves all lines starting with # to the top of the file, and sort by refname and start position using unix utilities sort and grep'

export const SORT_GFF_EXAMPLES = [
  '# sort gff and pipe to bgzip',
  '$ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz',
  '$ tabix sorted.gff.gz',
  '',
  '# sort gff from stdin',
  '$ cat input.gff | jbrowse sort-gff | bgzip > sorted.gff.gz',
]

export const REQUIRED_COMMANDS = ['sh', 'sort', 'grep'] as const
