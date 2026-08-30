import fs from 'fs'

import {
  codeCell,
  markdownTable,
  rewriteMarkerBlock,
  tableCell,
} from './util.ts'

// The pluggable element types, in the order the plugin manager creates them,
// rendered into the pluggable-elements guide from the schedule itself.
//
// The guide hand-listed the ten and then said, correctly, that the order is a
// real dependency rather than a listing convention: `install` runs before any
// element is built, the manager creates each group in turn, and a track type
// can therefore look up a display type by name because displays are built
// first. A page that leans on an order that hard should not be restating it
// from memory — and unlike most of these tables, a reordering here would leave
// the doc *plausible*, since every entry is still present and only the
// dependency it documents has quietly become false.
//
// Two columns, both off `PluginManager`:
//
// - the phase order and each group's name, from `pluggableElementTypeGroups`,
//   which the scheduler spreads — the spread is checked, so the table cannot go
//   on claiming an order the manager stopped building in;
// - the method a plugin calls to register one, from the `addElementType('<group>')`
//   call in each `addXType` wrapper — matched on the group string, so a renamed
//   method follows and a method registering into the wrong group shows up as a
//   row naming the wrong thing rather than as nothing at all.
const FILE = 'packages/core/src/PluginManager.ts'

export interface ElementPhase {
  /** the group string the scheduler and `addElementType` share */
  group: string
  /** `pluginManager.<method>` a plugin calls to register one */
  method: string
}

export function collectElementPhases(): ElementPhase[] {
  const text = fs.readFileSync(FILE, 'utf8')

  const declaration =
    /export const pluggableElementTypeGroups = \[([\s\S]*?)\] as const/.exec(
      text,
    )
  const groups = [...(declaration?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    m => m[1]!,
  )
  if (groups.length === 0) {
    throw new Error(
      `${FILE}: no \`pluggableElementTypeGroups\` array of group strings, which is the order the pluggable-elements guide documents`,
    )
  }
  if (
    !/elementCreationSchedule = new PhasedScheduler<PluggableElementTypeGroup>\(\s*\.\.\.pluggableElementTypeGroups,?\s*\)/.test(
      text,
    )
  ) {
    throw new Error(
      `${FILE}: \`elementCreationSchedule\` no longer spreads \`pluggableElementTypeGroups\`, so the guide's phase order would be a list the manager does not build in`,
    )
  }

  // `addXType(cb) { return this.addElementType('<group>', cb) }` — the method
  // name is the nearest declaration above the call that names the group
  const methods = new Map<string, string>()
  const lines = text.split('\n')
  for (const [i, line] of lines.entries()) {
    const call = /addElementType\('([^']+)'/.exec(line)
    if (!call) {
      continue
    }
    for (let j = i - 1; j >= 0 && j > i - 40; j--) {
      const decl = /^ {2}(add\w+)\(/.exec(lines[j]!)
      if (decl) {
        methods.set(call[1]!, decl[1]!)
        break
      }
    }
  }

  const unregistered = groups.filter(g => !methods.has(g))
  if (unregistered.length > 0) {
    throw new Error(
      `${FILE}: these element groups are scheduled but no \`addXType\` method registers into them, so the pluggable-elements guide would name a phase a plugin has no way to reach: ${unregistered.join(', ')}`,
    )
  }
  return groups.map(group => ({ group, method: methods.get(group)! }))
}

// The group strings are lowercase identifiers, and the one word among them that
// is an initialism has to be spelled as one — "Rpc method types" is the only
// thing sentence-casing gets wrong here. Listed rather than pattern-matched so a
// group added later renders plainly instead of being guessed at.
const INITIALISMS: Record<string, string> = { rpc: 'RPC' }

// "text search adapter" -> "Text search adapter types". The guide's own list
// wobbled between "Widgets" and "Adapter types"; one rule applied to the group
// string keeps the column consistent without anyone deciding per row.
function heading(group: string) {
  const words = group
    .split(' ')
    .map(
      (w, i) =>
        INITIALISMS[w] ??
        (i === 0 ? `${w.charAt(0).toUpperCase()}${w.slice(1)}` : w),
    )
  return `${words.join(' ')} types`
}

export function writeElementPhaseDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'ELEMENT_PHASES',
    markdownTable(
      ['Phase', 'Element type', 'Registered with'],
      collectElementPhases().map(
        (p, i) =>
          `| ${i + 1} | ${tableCell(heading(p.group))} | ${codeCell(`pluginManager.${p.method}()`)} |`,
      ),
    ),
    { check },
  )
}
