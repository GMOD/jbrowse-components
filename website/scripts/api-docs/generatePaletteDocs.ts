import * as ts from 'typescript'

import {
  jsDocText,
  markdownTable,
  parseSourceFileSyntactic,
  rewriteMarkerBlock,
} from './util.ts'

// Render the custom-palette-key table into the hand-written theming guide from
// the `Palette` module augmentation itself, so the set of keys a config theme
// may set can't drift from what MUI is actually told about. The hand-written
// version had gone stale in three separate ways at once: `textHighlight`, the
// `N` base and the whole `alignmentFill` group were missing, and so were eight
// of the twenty-one string colors.
//
// The keys and their types are read structurally, from two interfaces:
//
//   packages/core/src/ui/palette.ts   StringColors   the plain '#rrggbb' colors
//   packages/core/src/ui/theme.ts     Palette        everything Palette adds
//
// so a key joins the table by existing, never by being listed. Its description
// is the JSDoc on the member, which is why an undocumented member is a hard
// error rather than a blank cell — see assertDocumented.
//
// The guide opts in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- PALETTE_KEYS START -->
//   <!-- PALETTE_KEYS END -->
//
// Editing between the markers is pointless — it is overwritten on regen.
//
// The `#color`-tagged swatch tables lower down the same page are a different
// generator (generateColorDocs) over a different fact: those describe the
// default *value* of a color, this describes the *key* you set to change it.

const STRING_COLORS = {
  file: 'packages/core/src/ui/palette.ts',
  interface: 'StringColors',
}
const PALETTE = {
  file: 'packages/core/src/ui/theme.ts',
  interface: 'Palette',
}

interface Key {
  name: string
  type: string
  description: string
}

// A member's rendered type, shortened to what a config author needs to know.
// The augmentation's types are already short (`PaletteColor`, `string`,
// `Frames`), except for the two inline object literals — `bases` and its
// per-base members — which say nothing useful spelled out across a table cell.
function renderType(node: ts.PropertySignature) {
  const type = node.type
  return !type
    ? ''
    : ts.isTypeLiteralNode(type)
      ? 'object'
      : type.getText().replace(/\s+/g, ' ')
}

// Members of one interface declaration, including the nested members of an
// inline object type (`bases: { A: PaletteColor, ... }`), which are real keys a
// theme sets and so are rendered as `bases.A` rather than hidden behind the
// parent row.
function membersOf(node: ts.InterfaceDeclaration, prefix = ''): Key[] {
  return node.members.filter(ts.isPropertySignature).flatMap(m => {
    const name = `${prefix}${m.name.getText()}`
    const self = {
      name,
      type: renderType(m),
      description: jsDocText(m).replace(/\s+/g, ' ').trim(),
    }
    const nested =
      m.type && ts.isTypeLiteralNode(m.type)
        ? m.type.members.filter(ts.isPropertySignature).map(inner => ({
            name: `${name}.${inner.name.getText()}`,
            type: renderType(inner),
            description: jsDocText(inner).replace(/\s+/g, ' ').trim(),
          }))
        : []
    return [self, ...nested]
  })
}

// Find one interface by name anywhere in a file, including inside a
// `declare module '@mui/material/styles' { ... }` block — which is where the
// Palette augmentation lives, so a top-level-statements scan would miss it.
function findInterface({ file, interface: name }: typeof PALETTE) {
  let found: ts.InterfaceDeclaration | undefined
  const walk = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      found = node
    } else {
      ts.forEachChild(node, walk)
    }
  }
  walk(parseSourceFileSyntactic(file))
  if (!found) {
    throw new Error(`${file}: no \`interface ${name}\` to generate from`)
  }
  return found
}

// Fatal, not a warning, for the same reason an untagged config slot is: a
// member with no JSDoc renders as an empty cell, and an empty cell reads as
// "this key does nothing" rather than as a docs gap. The count is zero and the
// fix is one line at the definition site, so the only way it stays zero is if
// adding an undocumented key stops the build.
function assertDocumented(keys: Key[]) {
  const undocumented = keys.filter(k => !k.description)
  if (undocumented.length) {
    throw new Error(
      `${undocumented.length} palette key(s) have no JSDoc, so they would render as an empty row in the theming guide. Add a /** one-line */ comment on the interface member:\n${undocumented
        .map(k => `  ${k.name}`)
        .join('\n')}`,
    )
  }
}

export function collectPaletteKeys(): Key[] {
  // StringColors first: `Palette extends StringColors`, so that is the order a
  // reader of the augmentation meets them in.
  const keys = [
    ...membersOf(findInterface(STRING_COLORS)),
    ...membersOf(findInterface(PALETTE)),
  ]
  assertDocumented(keys)
  return keys
}

function renderTable(keys: Key[]) {
  return markdownTable(
    ['Key', 'Type', 'Used for'],
    keys.map(k => `| \`${k.name}\` | \`${k.type}\` | ${k.description} |`),
  )
}

export function writePaletteDocs({ check = false } = {}) {
  return rewriteMarkerBlock('PALETTE_KEYS', renderTable(collectPaletteKeys()), {
    check,
  })
}
