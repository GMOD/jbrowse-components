import fs from 'fs'

import { markdownTable, rewriteMarkerBlock } from './util.ts'

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

export function collectResultFields(): ResultField[] {
  const text = fs.readFileSync(FILE, 'utf8')
  const body = new RegExp(
    `export interface ${INTERFACE} \\{([\\s\\S]*?)\\n\\}`,
  ).exec(text)
  if (!body) {
    throw new Error(`${FILE}: no \`export interface ${INTERFACE}\``)
  }
  const lines = body[1]!.split('\n')
  const fields: ResultField[] = []
  const untagged: string[] = []
  for (const [i, line] of lines.entries()) {
    const member = /^ {2}(\w+)(\??):\s*(.+?)$/.exec(line)
    if (!member) {
      continue
    }
    // the tag is the last one above this member — a member whose JSDoc runs to
    // several lines keeps its tag on the block's first line
    let tag: RegExpExecArray | null = null
    for (
      let j = i - 1;
      j >= 0 && !tag && !/^ {2}\w+\??:/.test(lines[j]!);
      j--
    ) {
      // `(?:\*\/|$)` because a one-line JSDoc closes on the same line: without
      // it the excluded `*` in the description class cannot reach `$`, and every
      // single-line tag reads as untagged
      tag = /#resultField\s+([^\n*]+?)\s*(?:\*\/|$)/.exec(lines[j]!)
    }
    if (tag) {
      fields.push({
        name: member[1]!,
        optional: member[2] === '?',
        type: member[3]!.replace(/,$/, '').trim(),
        description: tag[1]!.trim(),
      })
    } else {
      untagged.push(member[1]!)
    }
  }
  if (untagged.length > 0) {
    throw new Error(
      `these ${INTERFACE} members carry no \`#resultField <description>\` tag, so they would be missing from the text-search-adapter guide: ${untagged.join(', ')}`,
    )
  }
  return fields
}

export function writeSearchResultDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'SEARCH_RESULT_FIELDS',
    markdownTable(
      ['Field', 'Type', 'Purpose'],
      collectResultFields().map(
        f =>
          `| \`${f.name}\`${f.optional ? '' : ' (required)'} | \`${f.type}\` | ${f.description} |`,
      ),
    ),
    { check },
  )
}
