import fs from 'fs'

import { markdownTable, rewriteMarkerBlock } from './util.ts'

import type { SourceCorpus } from './util.ts'

// The menus guide used to carry the whole of `MenuTypes.ts` as an `include:`
// fence — ~130 lines of interface declarations and maintainer rationale — plus a
// bullet list naming the variants, plus a paragraph restating the union under
// it. Three hand-maintained restatements of one file, and the builder paragraph
// beside them was already four exports short (`radioItem`, `makeRadioSubMenu`,
// `showLegendCheckboxItem`, `staysOpenOnClick`).
//
// So the guide takes tables instead, from three tags at the definition sites:
//
//   /** #menuItem <type value> | <description> */      on each MenuItem variant
//   /** #menuField <description> */                     on each BaseMenuItem field
//   /** #menuBuilder <name> | <description> */          on each builder function
//
// Structure (which variant carries which field, what a builder's signature is)
// is read off the source; only the prose comes from a tag. An untagged variant
// or builder is fatal, same as the untagged-`#extensionPoint` check: a table
// that quietly omits a row reads as "this doesn't exist".

interface MenuItemType {
  /** the `type` string a row sets, e.g. `checkbox` */
  value: string
  description: string
  /** interface name, e.g. `CheckboxMenuItem` */
  name: string
  /** fields the variant adds on top of BaseMenuItem */
  fields: string[]
}

interface MenuField {
  name: string
  type: string
  optional: boolean
  description: string
}

interface MenuBuilder {
  name: string
  description: string
}

// The property lines of an `interface X … { … }` body, as `name: type` pairs.
// Members are one-per-line in this file and the shapes are flat, so a line scan
// is enough; anything nested would show up as an unterminated type and is caught
// by the assertions in the callers rather than silently mis-parsed.
function interfaceMembers(text: string, name: string) {
  const re = new RegExp(`interface ${name}[^{]*\\{`, 'g')
  const m = re.exec(text)
  if (!m) {
    return undefined
  }
  let depth = 1
  let i = m.index + m[0].length
  const start = i
  while (i < text.length && depth > 0) {
    if (text[i] === '{') {
      depth++
    } else if (text[i] === '}') {
      depth--
    }
    i++
  }
  const body = text.slice(start, i - 1)
  return [...body.matchAll(/^ {2}(\w+)(\??):\s*(.+?)$/gm)].map(p => ({
    name: p[1]!,
    optional: p[2] === '?',
    type: p[3]!.replace(/,$/, '').trim(),
  }))
}

function collectItemTypes(file: string, text: string, out: MenuItemType[]) {
  const re =
    /#menuItem\s+(\w+)\s*\|\s*([^\n*]+?)\s*(?:\*\/|\n)[\s\S]*?interface\s+(\w+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const name = m[3]!
    const members = interfaceMembers(text, name)
    if (!members) {
      throw new Error(
        `#menuItem ${m[1]} names ${name}, which is not an interface in ${file}`,
      )
    }
    out.push({
      value: m[1]!,
      description: m[2]!.trim(),
      name,
      // `type` is the discriminant the first column already shows
      fields: members.filter(p => p.name !== 'type').map(p => p.name),
    })
  }
}

function collectFields(text: string, out: MenuField[]) {
  const members = interfaceMembers(text, 'BaseMenuItem')
  if (!members) {
    return
  }
  const byName = new Map(members.map(p => [p.name, p]))
  const re = /#menuField\s+([^\n*]+?)\s*(?:\*\/|\n)[\s\S]*?^ {2}(\w+)\??:/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const member = byName.get(m[2]!)
    if (member) {
      out.push({ ...member, description: m[1]!.trim() })
    }
  }
  const untagged = members
    .map(p => p.name)
    .filter(name => !out.some(f => f.name === name))
  if (untagged.length > 0) {
    throw new Error(
      `BaseMenuItem fields carry no \`#menuField <description>\` JSDoc tag, so they are missing from the menus guide: ${untagged.join(', ')}`,
    )
  }
}

function collectBuilders(text: string, out: MenuBuilder[]) {
  const re = /#menuBuilder\s+(\w+)\s*\|\s*([^\n*]+?)\s*(?:\*\/|\n)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ name: m[1]!, description: m[2]!.trim() })
  }
}

// Every value `menuItems.ts` re-exports, which is the entry a plugin imports
// from. It is the manifest that makes the builder table complete rather than
// aspirational: a builder added there and left untagged fails the run.
function reExportedBuilders() {
  const text = fs.readFileSync('packages/core/src/ui/menuItems.ts', 'utf8')
  return [...text.matchAll(/^export \{([\s\S]*?)\} from/gm)].flatMap(m =>
    m[1]!
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  )
}

const ROOT_MENU_MIXIN = 'packages/app-core/src/RootMenu/index.ts'

interface MenuAction {
  signature: string
  description: string
}

/**
 * The `#action`s of `RootAppMenuMixin`, which is the whole of the top-level menu
 * API. Read from that file rather than from the state-model accumulator so this
 * generator stays a standalone script; the JSDoc it reads is the same text
 * `/docs/models/rootappmenumixin` renders.
 */
function collectActions(): MenuAction[] {
  const text = fs.readFileSync(ROOT_MENU_MIXIN, 'utf8')
  const re =
    /\/\*\*\s*\n\s*\* #action\n([\s\S]*?)\*\/\s*\n\s*(\w+)\(([\s\S]*?)\)\s*[:{]/g
  const actions: MenuAction[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    // the prose above the first @param, unwrapped
    const description = m[1]!
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, ''))
      .join(' ')
      .split('@param')[0]!
      .replace(/\s+/g, ' ')
      .trim()
    const params = m[3]!
      .split(',')
      .map(p => p.trim().split(':')[0]!.trim())
      .filter(Boolean)
      .join(', ')
    actions.push({ signature: `${m[2]}(${params})`, description })
  }
  if (actions.length === 0) {
    throw new Error(`found no #action JSDoc blocks in ${ROOT_MENU_MIXIN}`)
  }
  const undocumented = actions.filter(a => !a.description)
  if (undocumented.length > 0) {
    throw new Error(
      `these RootAppMenuMixin actions have a #action tag with no prose under it, so they would render a blank cell in the menus guide: ${undocumented.map(a => a.signature).join(', ')}`,
    )
  }
  return actions
}

function collect(corpus: SourceCorpus) {
  const itemTypes: MenuItemType[] = []
  const fields: MenuField[] = []
  const builders: MenuBuilder[] = []
  for (const file of corpus.files) {
    const text = corpus.read(file)
    if (text.includes('#menuItem ') || text.includes('#menuField ')) {
      collectItemTypes(file, text, itemTypes)
      collectFields(text, fields)
    }
    if (text.includes('#menuBuilder ')) {
      collectBuilders(text, builders)
    }
  }
  const tagged = new Set(builders.map(b => b.name))
  // `staysOpenOnClick` and `resolveSubMenu` read a built row rather than build
  // one, so they are named in the guide's prose rather than in this table
  const readers = new Set(['staysOpenOnClick', 'resolveSubMenu'])
  const untagged = reExportedBuilders().filter(
    name => !tagged.has(name) && !readers.has(name),
  )
  if (untagged.length > 0) {
    throw new Error(
      `these values are re-exported from @jbrowse/core/ui/menuItems but carry no \`#menuBuilder <name> | <description>\` JSDoc tag, so they are missing from the menus guide: ${untagged.join(', ')}`,
    )
  }
  return {
    itemTypes: itemTypes.sort((a, b) => a.value.localeCompare(b.value)),
    fields,
    builders: builders.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

const code = (s: string) => `\`${s}\``

export function writeMenuDocs(corpus: SourceCorpus, { check = false } = {}) {
  const { itemTypes, fields, builders } = collect(corpus)
  return [
    ...rewriteMarkerBlock(
      'MENU_ITEM_TYPES',
      markdownTable(
        ['`type`', 'Own fields', 'Description'],
        itemTypes.map(
          t =>
            `| ${code(t.value)} | ${t.fields.map(code).join(', ') || '—'} | ${t.description} |`,
        ),
      ),
      { check },
    ),
    ...rewriteMarkerBlock(
      'MENU_ITEM_FIELDS',
      markdownTable(
        ['Field', 'Type', 'Description'],
        fields.map(
          f =>
            `| ${code(f.name)}${f.optional ? '' : ' (required)'} | ${code(f.type)} | ${f.description} |`,
        ),
      ),
      { check },
    ),
    ...rewriteMarkerBlock(
      'MENU_ITEM_BUILDERS',
      markdownTable(
        ['Builder', 'Description'],
        builders.map(b => `| ${code(b.name)} | ${b.description} |`),
      ),
      { check },
    ),
    ...rewriteMarkerBlock(
      'MENU_ACTIONS',
      markdownTable(
        ['Action', 'Description'],
        collectActions().map(
          a =>
            `| [${code(a.signature)}](/docs/models/rootappmenumixin#action-${a.signature.split('(')[0]!.toLowerCase()}) | ${a.description} |`,
        ),
      ),
      { check },
    ),
  ]
}
