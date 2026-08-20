// Which pieces of a figure recipe's click path were WRITTEN in
// spec-recipe/fields.ts, as opposed to interpolated from the figure's own data.
//
// `check-menu-labels.ts` asks of every `**A → B**` in docs prose whether the app
// still renders those labels. The recipes ask a reader to click the same menus
// and had no such check — `pnpm check-menu-labels` reads `website/docs/**` and
// nothing else — so a hand-written segment could name a row that does not
// exist, and one did: the recipes said "Gene glyph mode" where the menu says
// "Gene glyph".
//
// The hard part is telling a LABEL from a VALUE. A rendered path carries both
// ("Read height → Custom... → 12px"), and a checker that treats every segment as
// a label has to be told about every value a figure might hold, which is
// unbounded. So the split is taken from the source instead: whatever is typed
// between the backticks is a label the author asserted, and whatever arrives
// through a `${...}` is the figure's. Only the first kind is checked.
//
// Reading the source rather than the rendered path is also what covers the
// paths built by joining an array (`colorByStep`), whose segments never appear
// in one template.
import { readFileSync } from 'node:fs'

import * as ts from 'typescript'

// A segment of an authored path. Split on the arrow because one static chunk
// spans several ("… → Gene glyph mode → "), and trimmed because the arrow
// carries its own spaces.
function addSegments(text: string, out: Set<string>) {
  for (const piece of text.split('→')) {
    const trimmed = piece.trim()
    if (trimmed) {
      out.add(trimmed)
    }
  }
}

/**
 * Every literal piece of text the file puts in a path position: string literals
 * (a segments array's entries, a lookup table's values) and the static spans of
 * template literals (everything outside the `${}`s).
 *
 * Deliberately not scoped to the path-building expressions themselves. A label
 * table is several hops from the template that uses it, and following those hops
 * statically would be its own tree — so this over-collects, and the caller
 * intersects with what the recipes actually render. A string that is never a
 * path segment is never checked.
 */
export function authoredText(file: string): Set<string> {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const out = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      addSegments(node.text, out)
    } else if (ts.isTemplateExpression(node)) {
      addSegments(node.head.text, out)
      for (const span of node.templateSpans) {
        addSegments(span.literal.text, out)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out
}

// A checkbox row's path says which way to leave it, and the label is the part
// before that.
export function stripState(segment: string) {
  return segment.replace(/\s*\((?:un)?checked\)\s*$/, '').trim()
}

/**
 * The first segment of a path names the control it opens — a menu button, a
 * toolbar, a dialog — and none of those is a row the app renders as a label.
 * `check-menu-labels.ts` keeps the same list for docs prose
 * (STRUCTURAL_MENU_NAMES); this one is the recipes' own, and longer because a
 * recipe reaches controls prose rarely walks a reader to.
 */
export const PATH_ROOTS = new Set([
  'Track menu',
  'View menu',
  'Synteny view header',
  'Graph view menu',
  'Graph view toolbar',
  'Dotplot header',
  'Launch synteny view dialog',
  'palette button',
  'the ⋮ menu',
])

/**
 * Segments that are an instruction rather than a click: a setting with no
 * control of its own, where the recipe tells a reader what to do instead of
 * naming a row. `coverageHeight`'s drag handle is the same idea one segment
 * earlier.
 *
 * Every entry is asserted to be in use below, so rewording one does not leave a
 * dead exemption covering nothing — the new wording gets checked, which is the
 * safe direction. `pnpm check-spec-recipes` deletes the entry that stopped
 * applying, and its comment with it when nothing else is under that comment.
 */
export const PATH_PROSE = new Set([
  // a right-click on the canvas, at a column the reader picks
  'Right-click the track at the column to sort on',
  // the location box, then the highlight control
  'Zoom to region / use the location box, then add a highlight',
  // the tree sidebar's own drag/checkbox/swatch affordances, none of them menu
  // rows
  'drag the rows into order',
  "set each row's color",
  'untick the rows you do not want',
  // the label IS the count ("2,767 alignments map to 9 contigs not shown"), so
  // it reads differently on every view and there is no fixed string to check
  'the checkbox naming how many alignments map to contigs not shown',
])

/**
 * A segment carrying markdown emphasis is a sentence the recipe wrapped around
 * a label ("Open the view: **Add → Graph genome view**, then …"), so the label
 * inside it is real and the segment as a whole is not. Left unchecked rather
 * than unwrapped: pairing the `**` back up is check-menu-labels' job on prose,
 * and these are the only four.
 */
export function isProseWrapped(segment: string) {
  return segment.includes('**')
}
