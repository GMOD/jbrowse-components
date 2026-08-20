import * as ts from 'typescript'

import {
  lastTaggedLine,
  markdownTable,
  parseSourceFileSyntactic,
  rewriteMarkerBlock,
} from './util.ts'

// Render the fetch-lifecycle autorun table into the data-fetching guide and the
// architecture spec from the install sites themselves. Both had drifted, in the
// way a hand-copied table always does — quietly and only in the rows nobody
// re-reads. The guide had `ClearBlockingStateOnViewportChange` clearing on
// `regionTooLarge`, which stopped being true when that gate became a derived
// getter, and it never learned that `DisplayedRegionsChange` also drops the
// cached byte estimate.
//
// The autorun's NAME and DEBOUNCE are read structurally off the install call —
//
//   autorunOnReadyView(self, fn, { name: 'FetchVisibleRegions', delay: 600 })
//   onDisplayedRegionsChange(self, fn, 'DisplayedRegionsChange')
//
// so neither can be restated wrongly, and a renamed or newly-installed autorun
// joins the table by existing. What it fires on and what it does are prose, and
// come from a tag in the comment already sitting above the call:
//
//   // #autorun <fires on> | <action>
//
// Deliberately NOT repeating the name in the tag: the two would be a drift axis
// of their own, which is the whole failure this generator exists to remove.
//
// Both docs opt in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- FETCH_AUTORUNS START -->
//   <!-- FETCH_AUTORUNS END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

const SOURCE =
  'plugins/linear-genome-view/src/BaseLinearDisplay/models/installPerRegionFetchAutoruns.ts'

// The two installers `installPerRegionFetchAutoruns` builds on. Each names the
// argument its autorun name comes from: an options object for the general one,
// a positional string for the displayed-regions helper.
const INSTALLERS: Record<string, 'options' | 'thirdArg'> = {
  autorunOnReadyView: 'options',
  onDisplayedRegionsChange: 'thirdArg',
}

const COUNTS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
]

interface Autorun {
  name: string
  delay?: number
  firesOn: string
  action: string
}

// The string value of `key` in an object-literal argument, plus the numeric
// `delay` beside it. Only plain literals are read: an autorun whose name is
// computed has nothing stable to document anyway.
function optionsArg(node: ts.CallExpression) {
  const obj = node.arguments.at(-1)
  if (!obj || !ts.isObjectLiteralExpression(obj)) {
    return undefined
  }
  const prop = (key: string) =>
    obj.properties.find(
      (p): p is ts.PropertyAssignment =>
        ts.isPropertyAssignment(p) &&
        ts.isIdentifier(p.name) &&
        p.name.text === key,
    )?.initializer
  const name = prop('name')
  const delay = prop('delay')
  if (!name || !ts.isStringLiteral(name)) {
    return undefined
  }
  // A `delay` that isn't a literal — a named constant, an expression — would
  // otherwise drop out of the table in silence, and the docs would go on quoting
  // whatever number was last written by hand. That is the one drift this
  // generator exists to close, so refuse rather than omit.
  if (delay && !ts.isNumericLiteral(delay)) {
    throw new Error(
      `${SOURCE}: the \`${name.text}\` autorun's \`delay\` is not a numeric literal, so the generated table cannot quote it`,
    )
  }
  return {
    name: name.text,
    delay: delay ? Number((delay as ts.NumericLiteral).text) : undefined,
  }
}

function thirdArg(node: ts.CallExpression) {
  const arg = node.arguments[2]
  return arg && ts.isStringLiteral(arg) ? { name: arg.text } : undefined
}

// The `#autorun <fires on> | <action>` tag from the comment block above a call.
// The comment attaches to the enclosing *statement*, so this climbs: the call's
// own expression statement first, then outward — `SettingsInvalidate` is
// installed inside an `if (self.rpcProps)`, and its comment sits above the `if`.
// `lastTaggedLine` enforces that the tag heads its comment line, so prose that
// merely mentions `#autorun` is not read as one — see its comment for why that
// matters.
function tagAbove(node: ts.Node, text: string) {
  for (let cur: ts.Node | undefined = node; cur; cur = cur.parent) {
    if (ts.isStatement(cur)) {
      const value = lastTaggedLine(
        (ts.getLeadingCommentRanges(text, cur.getFullStart()) ?? [])
          .map(r => text.slice(r.pos, r.end))
          .join('\n'),
        'autorun',
      )
      if (value) {
        const [firesOn, ...rest] = value.split('|').map(s => s.trim())
        if (!firesOn || !rest.length) {
          throw new Error(
            `${SOURCE}: malformed #autorun tag "${value}" — expected \`#autorun <fires on> | <action>\``,
          )
        }
        return { firesOn, action: rest.join(' | ') }
      }
    }
  }
  return undefined
}

export function collectAutoruns(): Autorun[] {
  const source = parseSourceFileSyntactic(SOURCE)
  const text = source.getFullText()
  const out: Autorun[] = []
  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const kind = INSTALLERS[node.expression.text]
      const named =
        kind === 'options'
          ? optionsArg(node)
          : kind === 'thirdArg'
            ? thirdArg(node)
            : undefined
      if (named) {
        const tag = tagAbove(node, text)
        if (!tag) {
          throw new Error(
            `${SOURCE}: the \`${named.name}\` autorun has no \`#autorun <fires on> | <action>\` tag in the comment above it, so it would be missing from the generated fetch-autorun table`,
          )
        }
        out.push({ ...named, ...tag })
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(source)
  if (!out.length) {
    throw new Error(`${SOURCE}: found no autorun install sites to document`)
  }
  return out
}

// The count leads the table, so "the five autoruns" can't outlive a sixth. The
// debounce rides the trigger cell for the same reason: 600 is a number in the
// source, not one to retype. It reads "immediate, then debounced" because
// `autorunOnReadyView`'s `delay` is leading-edge — see leadingEdgeAutorun.
function render(autoruns: Autorun[]) {
  const count = COUNTS[autoruns.length] ?? String(autoruns.length)
  return [
    `\`installPerRegionFetchAutoruns\` installs ${count} autoruns:`,
    '',
    markdownTable(
      ['Autorun', 'Fires on', 'Action'],
      autoruns.map(
        a =>
          `| \`${a.name}\` | ${a.firesOn}${
            a.delay ? ` (immediate, then debounced ${a.delay} ms)` : ''
          } | ${a.action} |`,
      ),
    ),
  ].join('\n')
}

export function writeFetchAutorunDocs({ check = false } = {}) {
  return rewriteMarkerBlock('FETCH_AUTORUNS', render(collectAutoruns()), {
    check,
  })
}
