import fs from 'fs'

import {
  codeCell,
  markdownTable,
  rewriteMarkerBlock,
  tableCell,
} from './util.ts'

// The closed set of config slot `type` names, rendered into the
// configuration-schema guide from the three tables that define it.
//
// The guide used to carry two hand-written mirrors of this set, and both had
// already gone wrong in the same direction — short, and silently so. The slot
// type table listed twelve of the seventeen names (every `maybe*` form was
// relegated to a following paragraph) and called `color` a "Validated CSS color
// string", which it has never been: the model is a bare `types.string` and the
// editor picks a widget off the slot's `type` metadata. The graphical-editing
// list under it was the same set minus two more, restating the editor column of
// the first table for ten of the seventeen.
//
// Three sources, each already the single source of truth for one column, none
// of them hand-mirrored here:
//
// - `slotTypes` in configurationSlot.ts — the names, and the MST model each one
//   builds its value from. `ENUM_SLOT_TYPES` beside it carries the two names
//   with no builtin model, since the author supplies the `types.enumeration`.
// - `SlotValueByType` in types.ts — what a `getConf`/`readConfObject` read of
//   the slot is typed as. tsc already checks that it names the same set as
//   `slotTypes`; this only has to find a row per name.
// - `valueComponents` in SlotEditor.tsx — the config editor's dispatch from a
//   runtime type string to a control, with the control named by a `#slotEditor`
//   tag on the component itself.
//
// That last one is the gate worth having. `valueComponents` is typed
// `Record<string, ...>` (it has to be — see its own comment), so nothing checks
// it against the slot types that exist: a new type with no entry there falls
// back to `StringEditor` behind a `console.warn`, which is a config editor that
// renders a number as a text box and says so nowhere a user or an author looks.
// A missing entry fails this generator instead.
const SLOT_FILE = 'packages/core/src/configuration/configurationSlot.ts'
const TYPES_FILE = 'packages/core/src/configuration/types.ts'
const EDITOR_FILE =
  'plugins/config/src/ConfigurationEditorWidget/components/SlotEditor.tsx'

// The two enum types' cells. `slotTypes` has no entry for them and
// `SlotValueByType` deliberately omits them (both files say why): the author
// passes the `types.enumeration` as the slot's `model`, so the value type is
// whatever they wrote. That is a property of the two names rather than a fact
// stored anywhere to read, so it is stated once here rather than tagged twice.
const ENUM_MODEL = 'the `model` the slot declares'
const ENUM_READ_TYPE = "the `model` enumeration's members"

export interface SlotTypeRow {
  name: string
  /** the MST type the slot's value is built from */
  model: string
  /** what a read of the slot is typed as */
  readsAs: string
  /** what the config editor renders, from the component's `#slotEditor` tag */
  editor: string
  /**
   * true for the two enum types, whose model and read type are the author's own
   * and so render as prose rather than as a code cell
   */
  fromModel: boolean
}

// The expression after `model:`, up to the `,` or `}` that ends it at depth 0.
// A line-oriented regex would do for most entries and then take
// `types.array(types.string), fallbackDefault: []` whole for the ones that
// share a line with their fallback.
function modelExpression(entry: string, name: string) {
  const at = entry.indexOf('model:')
  if (at === -1) {
    throw new Error(`${SLOT_FILE}: slot type \`${name}\` declares no \`model\``)
  }
  let depth = 0
  const from = at + 'model:'.length
  for (let i = from; i < entry.length; i++) {
    const c = entry[i]!
    if (c === '(' || c === '[' || c === '{') {
      depth++
    } else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) {
        return entry.slice(from, i).trim()
      }
      depth--
    } else if (c === ',' && depth === 0) {
      return entry.slice(from, i).trim()
    }
  }
  return entry.slice(from).trim()
}

// Split an object literal's body into its top-level `name: ...` entries, keyed
// by name. Entries are two-space indented and span as many lines as they like,
// so an entry runs to the start of the next one — which means a slice also
// carries whatever comment introduces the entry after it. Only `model:` is read
// out of these, and that is found by first occurrence, so the overrun is
// harmless here and is why the interface members below get their own parser.
function objectEntries(body: string) {
  const starts = [...body.matchAll(/^ {2}(\w+):/gm)]
  return new Map(
    starts.map(({ 0: _m, 1: name, index }, i) => [
      name!,
      body.slice(index, starts[i + 1]?.index ?? body.length),
    ]),
  )
}

// `name -> type` over an interface body. One line per member, so this cannot
// pick up the JSDoc of the member after it — which a slice-to-the-next-member
// parser does, and did: `maybeColor` read as its own type followed by the whole
// paragraph explaining why `frozen` is `any`.
function interfaceMembers(body: string) {
  return new Map(
    [...body.matchAll(/^ {2}(\w+)\??: (.+?);?$/gm)].map(m => [
      m[1]!,
      m[2]!.trim(),
    ]),
  )
}

// The body of a named declaration, from its opening brace to `closing`. The
// closer is stated rather than assumed: an object/interface ends at a
// column-zero `\n}`, but `ENUM_SLOT_TYPES` is a one-line array, and searching it
// for the next `\n}` ran on into the rest of the file — the two enum names came
// back as four, picking up `'enum'` and `'JexlString'` out of the prose and
// `types.enumeration` calls below.
function block(file: string, opening: string, closing: string, what: string) {
  const text = fs.readFileSync(file, 'utf8')
  const at = text.indexOf(opening)
  if (at === -1) {
    throw new Error(`${file}: no \`${opening}\` — ${what}`)
  }
  const from = at + opening.length
  const end = text.indexOf(closing, from)
  if (end === -1) {
    throw new Error(`${file}: \`${opening}\` is never closed by \`${closing}\``)
  }
  return text.slice(from, end)
}

/** `Name -> what its `#slotEditor` tag says it renders`, over the editor components. */
function editorLabels() {
  const dir = 'plugins/config/src/ConfigurationEditorWidget/components'
  const labels = new Map<string, string>()
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
    const text = fs.readFileSync(`${dir}/${file}`, 'utf8')
    // the tag sits in a one-line JSDoc directly above the component
    for (const m of text.matchAll(
      /\/\*\* #slotEditor ([^\n]*?) \*\/\n(?:export default )?(?:const|function) (\w+)/g,
    )) {
      labels.set(m[2]!, m[1]!)
    }
  }
  return labels
}

export function collectSlotTypes(): SlotTypeRow[] {
  const models = objectEntries(
    block(
      SLOT_FILE,
      'const slotTypes = {',
      '\n}',
      'the builtin slot type table is what names every type',
    ),
  )
  const enumNames = [
    ...block(
      SLOT_FILE,
      'const ENUM_SLOT_TYPES = [',
      ']',
      'the two slot types whose model the author supplies',
    ).matchAll(/'(\w+)'/g),
  ].map(m => m[1]!)

  const readTypes = interfaceMembers(
    block(
      TYPES_FILE,
      'interface SlotValueByType {',
      '\n}',
      'the type-level twin of `slotTypes`, which is the read-type column',
    ),
  )

  const dispatch = new Map(
    [
      ...block(
        EDITOR_FILE,
        'const valueComponents: Record<string, React.ComponentType<any>> = {',
        '\n}',
        "the config editor's slot type -> control dispatch",
      ).matchAll(/^ {2}(\w+): (\w+),$/gm),
    ].map(m => [m[1]!, m[2]!]),
  )
  const labels = editorLabels()

  const missingEditor: string[] = []
  const unlabelled = new Set<string>()
  const rows = [...models.keys(), ...enumNames].map(name => {
    const isEnum = enumNames.includes(name)
    const component = dispatch.get(name)
    if (!component) {
      missingEditor.push(name)
    } else if (!labels.has(component)) {
      unlabelled.add(component)
    }
    const readsAs = readTypes.get(name)
    if (!isEnum && !readsAs) {
      throw new Error(
        `${TYPES_FILE}: \`SlotValueByType\` has no \`${name}\` row, so the configuration-schema guide would say nothing about what reading a \`${name}\` slot returns. The two tables are meant to name the same set — see the assertion under \`SlotValueByType\`.`,
      )
    }
    return {
      name,
      model: isEnum ? ENUM_MODEL : modelExpression(models.get(name)!, name),
      readsAs: isEnum ? ENUM_READ_TYPE : readsAs!,
      editor: component ? (labels.get(component) ?? '') : '',
      fromModel: isEnum,
    }
  })

  if (missingEditor.length > 0) {
    throw new Error(
      `these slot types have no entry in \`valueComponents\` (${EDITOR_FILE}), so the config editor renders them as a plain text box behind a console.warn: ${missingEditor.join(', ')}`,
    )
  }
  if (unlabelled.size > 0) {
    throw new Error(
      `these slot editor components carry no \`/** #slotEditor <what it renders> */\` tag, so the configuration-schema guide would leave their control blank: ${[...unlabelled].join(', ')}`,
    )
  }
  return sortByBaseType(rows)
}

// Alphabetical by the type a name is a form of, with each `maybe*` directly
// under its plain sibling — `boolean`, `maybeBoolean`, `color`, `maybeColor`.
// The source order is neither, and the pairing is the whole point of the
// `maybe*` column: the two rows differ in one cell.
function sortByBaseType(rows: SlotTypeRow[]) {
  const base = (name: string) =>
    name.startsWith('maybe')
      ? name.slice(5, 6).toLowerCase() + name.slice(6)
      : name
  return [...rows].sort(
    (a, b) =>
      base(a.name).localeCompare(base(b.name)) ||
      Number(a.name.startsWith('maybe')) - Number(b.name.startsWith('maybe')),
  )
}

export function writeSlotTypeDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'SLOT_TYPES',
    markdownTable(
      ['`type`', 'MST model', 'Reads as', 'Config editor renders'],
      collectSlotTypes().map(r => {
        // the two enum rows say where their model and read type come from,
        // which is prose; every other row's is an expression from the source
        const value = r.fromModel ? tableCell : codeCell
        return `| ${codeCell(r.name)} | ${value(r.model)} | ${value(r.readsAs)} | ${tableCell(r.editor)} |`
      }),
    ),
    { check },
  )
}
