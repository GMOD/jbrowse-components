import { SORT_BED_DESCRIPTION, SORT_BED_EXAMPLES } from './constants'

export function getHelpText(): string {
  return `
${SORT_BED_DESCRIPTION}

USAGE
  $ jbrowse sort-bed <file>

ARGUMENTS
  file  BED file

OPTIONS
  -h, --help  Show help

EXAMPLES
${SORT_BED_EXAMPLES.join('\n')}
`
}
