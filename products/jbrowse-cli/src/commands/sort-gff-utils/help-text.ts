import { SORT_GFF_DESCRIPTION, SORT_GFF_EXAMPLES } from './constants'

export function getHelpText(): string {
  return `
${SORT_GFF_DESCRIPTION}

USAGE
  $ jbrowse sort-gff [file]
  $ cat file.gff | jbrowse sort-gff

ARGUMENTS
  file  GFF file (optional when using stdin)

OPTIONS
  -h, --help  Show help

EXAMPLES
${SORT_GFF_EXAMPLES.join('\n')}
`
}
