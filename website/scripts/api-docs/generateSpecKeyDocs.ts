import * as ts from 'typescript'

import { resolvedProperties } from './generateStateModelDocs.ts'
import {
  markdownTable,
  parseSourceFileSyntactic,
  proseCell,
  rewriteGroupedMarkerBlocks,
} from './util.ts'

import type { StateModel } from './generateStateModelDocs.ts'
import type { SourceCorpus } from './util.ts'

// Render the "what can I put in a session spec for this view type" tables into
// the URL parameters page, from the views' own declarations.
//
// The page used to hand-list these, one bullet per key, per view type, and the
// lists had already drifted the way every hand-written table here has:
//
// - `showCytobands` and `showTrackOutlines` were documented "(default `true`)".
//   Both are `types.optional(..., () => localStorageGetBoolean(..., true))` —
//   the default is the visitor's stored preference, so a spec omitting them
//   does not open the same way for everyone.
// - the synteny `colorBy` list named nine of its ten modes, missing `dnds`.
// - `showHighlightChips` is declared by a mixin, so a list built by reading the
//   view's own file omitted it; a missing row reads as "not settable" exactly
//   the way a blank cell reads as "does nothing".
// - the linear genome view's keys were split across two lists on no principle,
//   with members of BOTH buckets in each. The launcher partitions them exactly
//   two ways, and the page's word for one bucket ("init options") named the
//   other one in the code.
//
// So the names and their descriptions come from the source now, and the page
// keeps only the spec-authoring advice that no declaration carries.
//
// A view type opts in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- SPEC_KEYS LinearGenomeView START -->
//   <!-- SPEC_KEYS LinearGenomeView END -->
//
// Editing between the markers is pointless — it is overwritten on regen.
//
// Not in MARKER_GENERATORS, and so not run by `markers.ts`: half of what a spec
// can set on a view is the model's `#property` set including everything it
// composes in, which only the shared TypeScript program knows. generate.ts
// calls this one directly, and its `gendocs` autogen entry is the gate.
//
// NOTHING HERE NAMES A FILE. Every input is found by scanning the same file
// list the rest of the api-docs generators walk, for a tag at the declaration:
//
//   #launchKeys <ViewType>   the bucket of keys resolved on load and discarded,
//                            as opposed to state the model holds. On the object
//                            literal or interface that defines the bucket.
//   #valueList <key>         a const string array whose members are the values
//                            that key accepts, spelled out in its row.
//
// Path constants were the first cut and they were the wrong shape: this file
// exists because hand-maintained lists go stale, and a hardcoded
// `plugins/<a>/src/<b>/types.ts` is one more of them — it survives a rename
// silently in the worst case, since a bucket that resolves to nothing renders
// an empty section rather than failing. The tags cannot: an unresolvable
// `#launchKeys` group is fatal below.

// Never settable from a spec whatever the model declares, because the launcher
// reserves them. Mirrors RESERVED in the linear genome view's initKeys.ts.
const RESERVED = new Set(['id', 'type', 'init'])

// Keys that are the spec's own structure rather than a setting, and are the
// subject of the prose around every marker already.
const STRUCTURAL = new Set(['views', 'tracks'])

export interface SpecKey {
  name: string
  docs: string
}

interface TaggedBucket {
  viewType: string
  keys: SpecKey[]
  // interfaces this one extends, resolved against the other tagged/plain
  // interfaces found in the scan so a bucket split across packages renders
  // whole rather than as whichever half carries the tag
  extends: string[]
}

// The `#tag value` on the line-comment or JSDoc block directly above a node.
function tagAbove(node: ts.Node, text: string, tag: string) {
  const comment = (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [])
    .map(r => text.slice(r.pos, r.end))
    .join('\n')
  return new RegExp(String.raw`#${tag}\s+(\S+)`).exec(comment)?.[1]
}

// A member's own description: the `//` run or JSDoc body above it, minus any
// `#tag` lines, joined into one paragraph.
function docsAbove(node: ts.Node, text: string) {
  return (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [])
    .map(r => text.slice(r.pos, r.end))
    .join('\n')
    .split('\n')
    .map(l =>
      l
        .replace(/^\s*\/\*\*?/, '')
        .replace(/\*\/\s*$/, '')
        .replace(/^\s*\*/, '')
        .replace(/^\s*\/\/ ?/, '')
        .trim(),
    )
    .filter(l => l && !l.startsWith('#'))
    .join(' ')
    .trim()
}

interface Scan {
  buckets: TaggedBucket[]
  // every interface seen, tagged or not, so an extends clause resolves
  interfaces: Map<string, SpecKey[]>
  valueLists: Map<string, string[]>
  // the Commands type argument of every `ViewInit<Model, Commands>`, which is
  // the structural definition of "this view has a launch-key bucket". Compared
  // against the tagged set below, because an untagged one is invisible in the
  // rendered page: the table still builds, out of the model's properties
  // alone, and simply lacks the launcher's own keys. That is how the dotplot
  // lost `autoDiagonalize` — the key was in the doc before this generator, and
  // its absence afterwards looked like a key that had never existed.
  commandTypes: Set<string>
}

function stringArrayOf(decl: ts.VariableDeclaration) {
  const init = decl.initializer
  // `[...] as const` wraps the array in an AsExpression
  const arr = init && ts.isAsExpression(init) ? init.expression : init
  return arr && ts.isArrayLiteralExpression(arr)
    ? arr.elements.filter(ts.isStringLiteral).map(e => e.text)
    : undefined
}

/**
 * Walk every source file once, collecting the tagged buckets, every interface
 * (so extends clauses resolve), and the tagged value lists.
 */
export function scanSpecKeys(corpus: SourceCorpus): Scan {
  const buckets: TaggedBucket[] = []
  const interfaces = new Map<string, SpecKey[]>()
  const valueLists = new Map<string, string[]>()
  const commandTypes = new Set<string>()

  for (const file of corpus.files) {
    const source = parseSourceFileSyntactic(file, corpus.read(file))
    const text = source.getFullText()
    const walk = (node: ts.Node) => {
      // `export type XViewInit = ViewInit<XViewStateModel, XViewCommands>`
      if (
        ts.isTypeReferenceNode(node) &&
        node.typeName.getText() === 'ViewInit' &&
        node.typeArguments?.length === 2
      ) {
        const commands = node.typeArguments[1]!
        if (ts.isTypeReferenceNode(commands)) {
          commandTypes.add(commands.typeName.getText())
        }
      }
      if (ts.isInterfaceDeclaration(node)) {
        const keys = node.members
          .filter(ts.isPropertySignature)
          .filter(m => m.name)
          .map(m => ({
            name: m.name!.getText(),
            docs: docsAbove(m, text),
          }))
        interfaces.set(node.name.text, keys)
        const viewType = tagAbove(node, text, 'launchKeys')
        if (viewType) {
          buckets.push({
            viewType,
            keys,
            extends: (node.heritageClauses ?? []).flatMap(c =>
              c.types.map(t => t.expression.getText()),
            ),
          })
        }
      }
      // the object-literal form: `Record<keyof InitState, true>`, whose keys are
      // the bucket and whose descriptions live wherever that view documents
      // them (for the LGV, one `&param=` section each, further up the page)
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const parent = node.parent.parent
        const viewType =
          tagAbove(node, text, 'launchKeys') ??
          (ts.isVariableStatement(parent)
            ? tagAbove(parent, text, 'launchKeys')
            : undefined)
        if (viewType && node.initializer) {
          if (ts.isObjectLiteralExpression(node.initializer)) {
            buckets.push({
              viewType,
              keys: node.initializer.properties
                .filter(ts.isPropertyAssignment)
                .map(p => ({ name: p.name.getText(), docs: '' })),
              extends: [],
            })
          }
        }
        const listFor =
          tagAbove(node, text, 'valueList') ??
          (ts.isVariableStatement(parent)
            ? tagAbove(parent, text, 'valueList')
            : undefined)
        if (listFor) {
          const values = stringArrayOf(node)
          if (!values?.length) {
            throw new Error(
              `${file}: \`${node.name.text}\` is tagged \`#valueList ${listFor}\` but is not a non-empty array of string literals, so the "${listFor}" row in the URL parameters page would lose its list of accepted values`,
            )
          }
          valueLists.set(listFor, values)
        }
      }
      ts.forEachChild(node, walk)
    }
    walk(source)
  }
  const untagged = [...commandTypes].filter(
    name => !buckets.some(b => b.keys === interfaces.get(name)),
  )
  if (untagged.length) {
    throw new Error(
      `${untagged.join(', ')} — used as the Commands half of a \`ViewInit<>\`, so a session spec can set these keys, but carrying no \`#launchKeys <ViewType>\` tag. The URL parameters page would render that view's table from its model properties alone and silently omit every launcher key. Tag the interface.`,
    )
  }
  return { buckets, interfaces, valueLists, commandTypes }
}

// The model page a key's full row lives on, so the table can link a name to its
// description rather than restating it. Matches docPage's `id`, which is the
// slugified model name — and it is the page of the model that DECLARES the
// property, not the view that inherits it, since that is the page carrying the
// row.
function modelAnchor(declaredBy: string, name: string) {
  return `/docs/models/${declaredBy.toLowerCase()}#property-${name.toLowerCase()}`
}

function launchKeysFor(viewType: string, scan: Scan): SpecKey[] {
  const buckets = scan.buckets.filter(b => b.viewType === viewType)
  return buckets
    .flatMap(b => [
      ...b.keys,
      ...b.extends.flatMap(name => scan.interfaces.get(name) ?? []),
    ])
    .filter(k => !STRUCTURAL.has(k.name))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function renderGroup(
  viewType: string,
  models: Record<string, StateModel>,
  scan: Scan,
) {
  if (!Object.values(models).some(m => m.header?.name === viewType)) {
    throw new Error(
      `SPEC_KEYS names the view type "${viewType}", which is not a documented #stateModel. Either the marker has a typo or the view's model lost its #stateModel tag.`,
    )
  }
  const launch = launchKeysFor(viewType, scan)
  // A launch key shadows the model property of the same name: the launcher
  // consumes it, so the row a reader needs is the launch key's.
  const launchNames = new Set(launch.map(k => k.name))
  const props = resolvedProperties(models, viewType)
    .filter(
      p =>
        !RESERVED.has(p.member.name) &&
        !STRUCTURAL.has(p.member.name) &&
        !launchNames.has(p.member.name),
    )
    .sort((a, b) => a.member.name.localeCompare(b.member.name))

  const missing = props
    .filter(p => !p.member.docs.trim())
    .map(p => p.member.name)
  if (missing.length) {
    throw new Error(
      `${viewType}: ${missing.join(', ')} — a spec can set these, but their \`#property\` JSDoc carries no description, so the table in the URL parameters page would render a blank cell that reads as "this does nothing". Describe them at the declaration site.`,
    )
  }

  const table = markdownTable(
    ['Property', 'What it does'],
    props.map(
      p =>
        `| [\`${p.member.name}\`](${modelAnchor(p.declaredBy, p.member.name)}) | ${proseCell(p.member.docs)} |`,
    ),
  )
  if (!launch.length) {
    return table
  }

  // Two shapes, decided by whether the bucket carries descriptions. An
  // interface bucket does, so it renders as its own table. The object-literal
  // form does not, and does not need to: those keys are the simple URL params,
  // each already documented in its own section further up the page, so a table
  // of eight empty cells would be worse than the sentence.
  const described = launch.filter(k => k.docs)
  const head = described.length
    ? [
        '**Launch keys**, which name something to do on load rather than state the view holds:',
        '',
        markdownTable(
          ['Launch key', 'What it does'],
          described.map(k => {
            const values = scan.valueLists.get(k.name)
            const docs = values
              ? `${k.docs} One of ${values.map(v => `\`${v}\``).join(', ')}.`
              : k.docs
            return `| \`${k.name}\` | ${proseCell(docs)} |`
          }),
        ),
      ]
    : [
        `**Launch keys**, resolved once on attach and then discarded, because they have no direct representation in the view's state — ${launch.map(k => `\`${k.name}\``).join(', ')}. There are no others; a key outside this set and the table below is a typo, and the launcher names it in a console warning rather than dropping it silently.`,
      ]

  return [
    ...head,
    '',
    '**Properties**, which are whatever the state model declares and the view restores natively:',
    '',
    table,
  ].join('\n')
}

export function writeSpecKeyDocs(
  models: Record<string, StateModel>,
  corpus: SourceCorpus,
  { check = false } = {},
) {
  const scan = scanSpecKeys(corpus)
  const { stale, seen } = rewriteGroupedMarkerBlocks(
    'SPEC_KEYS',
    group => renderGroup(group, models, scan),
    { check },
  )
  // A tagged bucket no page renders is a tag that does nothing — the same
  // silent-no-op the path constants used to risk, caught from the other end.
  const unrendered = [...new Set(scan.buckets.map(b => b.viewType))].filter(
    v => !seen.has(v),
  )
  if (unrendered.length) {
    throw new Error(
      `#launchKeys tags name ${unrendered.join(', ')}, but no doc has a \`<!-- SPEC_KEYS <type> START -->\` marker for them, so the keys they declare are documented nowhere.`,
    )
  }
  return stale
}
