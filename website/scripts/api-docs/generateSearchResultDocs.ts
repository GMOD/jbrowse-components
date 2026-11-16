import * as ts from 'typescript'

import { rewriteMarkerBlock } from '../markerDocs.ts'
import { jsDocText, tagValues } from './jsDocTags.ts'
import { markdownTable } from './markdown.ts'

import type { SourceCorpus } from './sourceCorpus.ts'

// What a text search adapter may put on a `BaseResult`, rendered into the
// text-search-adapter guide from `BaseResultArgs`.
//
// The guide's hand-written table listed six of the seven — `refName` was missing,
// and it is the one a refName-returning adapter needs, mentioned on that page
// only in a trailing sentence about `RefSequenceResult`.
//
// The field name and optionality come off the declaration; only the one-line
// description comes from a tag:
//
//   /** #resultField where to navigate, e.g. `chr1:1000..2000` */
//
// A member of that interface with no tag is fatal — the table has to be the
// whole shape or an adapter author will read it as the whole shape anyway.
const FILE = 'packages/core/src/TextSearch/BaseResults.ts'
const INTERFACE = 'BaseResultArgs'

interface ResultField {
  name: string
  type: string
  optional: boolean
  description: string
}

export function collectResultFields(corpus: SourceCorpus): ResultField[] {
  const declaration = corpus
    .parse(FILE)
    .statements.filter(ts.isInterfaceDeclaration)
    .find(s => s.name.text === INTERFACE)
  if (!declaration) {
    throw new Error(`${FILE}: no \`export interface ${INTERFACE}\``)
  }
  const fields: ResultField[] = []
  const untagged: string[] = []
  for (const member of declaration.members.filter(ts.isPropertySignature)) {
    const name = member.name.getText()
    const description = tagValues(jsDocText(member), 'resultField').at(-1)
    if (description) {
      fields.push({
        name,
        optional: !!member.questionToken,
        type: member.type?.getText() ?? '',
        description,
      })
    } else {
      untagged.push(name)
    }
  }
  if (untagged.length > 0) {
    throw new Error(
      `these ${INTERFACE} members carry no \`#resultField <description>\` tag, so they would be missing from the text-search-adapter guide: ${untagged.join(', ')}`,
    )
  }
  return fields
}

export function writeSearchResultDocs(corpus: SourceCorpus) {
  return rewriteMarkerBlock(
    'SEARCH_RESULT_FIELDS',
    markdownTable(
      ['Field', 'Type', 'Purpose'],
      collectResultFields(corpus).map(
        f =>
          `| \`${f.name}\`${f.optional ? '' : ' (required)'} | \`${f.type}\` | ${f.description} |`,
      ),
    ),
  )
}
