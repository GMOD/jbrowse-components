import * as ts from 'typescript'

import { resolvedProperties } from './generateStateModelDocs.ts'
import { markdownTable, proseCell, rewriteGroupedMarkerBlocks } from './util.ts'

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
// NOTHING HERE NAMES A FILE, AND NOTHING HERE LISTS A VIEW TYPE. Every input is
// found by scanning the same file list the rest of the api-docs generators
// walk:
//
//   'LaunchView-<type>': { args: X }   the ExtensionPointRegistry augmentation
//                            each launcher declares. This is the registry of
//                            what a session spec can launch, so it decides
//                            which view types need a table AND names their
//                            args interface — no tag involved.
//   #launchKeys <ViewType>   for the views whose launch keys live in a separate
//                            Commands interface or key map rather than on the
//                            args interface itself.
//   #valueList <key>         a const string array whose members are the values
//                            that key accepts, spelled out in its row.
//   #property                the model half, including everything composed in.
//
// Path constants were the first cut and they were the wrong shape: this file
// exists because hand-maintained lists go stale, and a hardcoded
// `plugins/<a>/src/<b>/types.ts` is one more of them — it survives a rename
// silently in the worst case, since a bucket that resolves to nothing renders
// an empty section rather than failing.
//
// Four things are fatal, and each is a silent-omission mode this generator hit
// in its own first two passes rather than a hypothetical: a spec-settable key
// with no description, a launchable view type no page documents, a `ViewInit<>`
// Commands interface with no `#launchKeys` tag, and a partly-described launch
// bucket. The last three all render something that looks complete and is short.

// Never settable from a spec whatever the model declares. `id`/`type` are the
// view's identity; `init`/`launch` are the blob the partition fills, not
// something anyone writes; `session` is on every Launch*Args interface and is
// supplied by the launcher, never written in a link.
const RESERVED = new Set(['id', 'type', 'init', 'launch', 'session'])

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
  // viewType -> the Launch*Args interface, off the
  // `'LaunchView-<type>': { args: X }` entries each launcher adds to
  // PluginManager's ExtensionPointRegistry. That declaration IS the registry of
  // what a session spec can launch, so it answers "which view types need a
  // table" without a list to keep in step, and it names the interface too.
  launchArgs: Map<string, string>
  // interface name -> the keys its `extends Omit<SnapshotIn<Model>, 'a' | 'b'>`
  // takes away. Those are the model properties the launcher builds itself
  // (`spreadsheet` and `importWizard` are built from the init blob, `views` is
  // replaced by the declarative form), so they are declared, are not settable,
  // and would otherwise render as rows telling a reader to write them.
  omitted: Map<string, Set<string>>
}

// The key map itself, whether it is written bare (`Record<keyof X, true>`) or
// handed to a registrar (`defineLaunchKeys<X>()({ … }, { … })`). Only the first
// object argument is the map; the second is options.
function keyMapLiteral(init: ts.Expression | undefined) {
  if (!init) {
    return undefined
  }
  if (ts.isObjectLiteralExpression(init)) {
    return init
  }
  return ts.isCallExpression(init)
    ? init.arguments.find(a => ts.isObjectLiteralExpression(a))
    : undefined
}

function stringArrayOf(decl: ts.VariableDeclaration) {
  const init = decl.initializer
  // `[...] as const` wraps the array in an AsExpression
  const arr = init && ts.isAsExpression(init) ? init.expression : init
  return arr && ts.isArrayLiteralExpression(arr)
    ? arr.elements.filter(ts.isStringLiteral).map(e => e.text)
    : undefined
}

// Two generators ask for this scan off the same corpus — the URL parameters
// tables here and the LaunchView point table, which wants `launchArgs` alone —
// and it syntactically parses all ~3,900 sources, which cost a run 2.8s the
// second time. Keyed on the corpus because that is what the answer is a
// function of, and a corpus is built once per run and never written to.
const scans = new WeakMap<SourceCorpus, Scan>()

/**
 * Walk every source file once, collecting the tagged buckets, every interface
 * (so extends clauses resolve), and the tagged value lists.
 */
export function scanSpecKeys(corpus: SourceCorpus): Scan {
  let scan = scans.get(corpus)
  if (!scan) {
    scan = walkSpecKeys(corpus)
    scans.set(corpus, scan)
  }
  return scan
}

function walkSpecKeys(corpus: SourceCorpus): Scan {
  const buckets: TaggedBucket[] = []
  const interfaces = new Map<string, SpecKey[]>()
  const valueLists = new Map<string, string[]>()
  const commandTypes = new Set<string>()
  const launchArgs = new Map<string, string>()
  const omitted = new Map<string, Set<string>>()

  for (const file of corpus.files) {
    const source = corpus.parse(file)
    const text = source.getFullText()
    const walk = (node: ts.Node) => {
      // `'LaunchView-<type>': { args: LaunchXViewArgs; result: ... }` inside a
      // `declare module '@jbrowse/core/PluginManager'` ExtensionPointRegistry
      // augmentation. Matched on the key, not on the enclosing interface name,
      // so it does not care how a launcher spells its augmentation.
      if (ts.isPropertySignature(node) && node.name) {
        const key = node.name.getText().replaceAll(/['"]/g, '')
        const viewType = /^LaunchView-(.+)$/.exec(key)?.[1]
        if (viewType && node.type && ts.isTypeLiteralNode(node.type)) {
          for (const m of node.type.members) {
            if (
              ts.isPropertySignature(m) &&
              m.name?.getText() === 'args' &&
              m.type &&
              ts.isTypeReferenceNode(m.type)
            ) {
              launchArgs.set(viewType, m.type.typeName.getText())
            }
          }
        }
      }
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
        for (const clause of node.heritageClauses ?? []) {
          for (const t of clause.types) {
            if (
              t.expression.getText() === 'Omit' &&
              t.typeArguments?.length === 2
            ) {
              // the second argument is the removed key, or a union of them
              const removed = t.typeArguments[1]!
              const literals = ts.isUnionTypeNode(removed)
                ? removed.types
                : [removed]
              omitted.set(
                node.name.text,
                new Set(
                  literals.flatMap(l =>
                    ts.isLiteralTypeNode(l) && ts.isStringLiteral(l.literal)
                      ? [l.literal.text]
                      : [],
                  ),
                ),
              )
            }
          }
        }
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
        const literal = viewType && keyMapLiteral(node.initializer)
        if (literal) {
          buckets.push({
            viewType,
            keys: literal.properties
              .filter(ts.isPropertyAssignment)
              .map(p => ({ name: p.name.getText(), docs: '' })),
            extends: [],
          })
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
  return { buckets, interfaces, valueLists, commandTypes, launchArgs, omitted }
}

// The model properties this view's launcher builds itself, so a spec cannot set
// them however the model declares them.
function omittedFor(viewType: string, scan: Scan) {
  const argsName = scan.launchArgs.get(viewType)
  return argsName ? (scan.omitted.get(argsName) ?? new Set()) : new Set()
}

// The model page a key's full row lives on, so the table can link a name to its
// description rather than restating it. Matches docPage's `id`, which is the
// slugified model name — and it is the page of the model that DECLARES the
// property, not the view that inherits it, since that is the page carrying the
// row.
function modelAnchor(declaredBy: string, name: string) {
  return `/docs/models/${declaredBy.toLowerCase()}#property-${name.toLowerCase()}`
}

// Two idioms in the repo put a view's launch keys in two places, and a view
// uses one or the other:
//
// - the synteny and dotplot views declare a `Commands` interface and feed it to
//   `ViewInit<Model, Commands>`; their Launch*Args then wraps that, so its own
//   members are just plumbing and the keys come off the tagged interface.
// - the spreadsheet, SV inspector and breakpoint views have no Commands type.
//   Their Launch*Args is `Omit<SnapshotIn<Model>, …>` plus the launch keys
//   declared inline, so those members ARE the bucket.
//
// Both are read, and neither is special-cased by name: a view that has no keys
// under one idiom contributes nothing from it.
function launchKeysFor(viewType: string, scan: Scan): SpecKey[] {
  const tagged = scan.buckets
    .filter(b => b.viewType === viewType)
    .flatMap(b => [
      ...b.keys,
      ...b.extends.flatMap(name => scan.interfaces.get(name) ?? []),
    ])
  const argsName = scan.launchArgs.get(viewType)
  const inline = argsName ? (scan.interfaces.get(argsName) ?? []) : []
  const seen = new Set<string>()
  return [...tagged, ...inline]
    .filter(k => !STRUCTURAL.has(k.name) && !RESERVED.has(k.name))
    .filter(k => (seen.has(k.name) ? false : seen.add(k.name)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// A `#valueList` names the values one key accepts, and the key it names may be
// a launch key or a plain property — `colorBy` moved from one to the other when
// the comparative views stopped interpreting it, and its ten modes went with it
// until this reached both tables.
function withValues(name: string, docs: string, scan: Scan) {
  const values = scan.valueLists.get(name)
  return values
    ? `${docs} One of ${values.map(v => `\`${v}\``).join(', ')}.`
    : docs
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
  const launcherBuilds = omittedFor(viewType, scan)
  const props = resolvedProperties(models, viewType)
    .filter(
      p =>
        !RESERVED.has(p.member.name) &&
        !STRUCTURAL.has(p.member.name) &&
        !launcherBuilds.has(p.member.name) &&
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
        `| [\`${p.member.name}\`](${modelAnchor(p.declaredBy, p.member.name)}) | ${proseCell(withValues(p.member.name, p.member.docs, scan))} |`,
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
  // A bucket is all-described or none-described, and mixing is fatal rather
  // than partial. The none-described form is the linear genome view's, whose
  // keys are the simple URL params and are each documented in their own section
  // further up the page; rendering those as a table of empty cells would be
  // worse than the sentence. But a bucket where SOME carry a comment renders as
  // a table, and dropping the rest from it is the silent omission this whole
  // generator exists to prevent — it is how the dotplot lost `autoDiagonalize`,
  // reproduced one layer down.
  const described = launch.filter(k => k.docs)
  if (described.length && described.length !== launch.length) {
    throw new Error(
      `${viewType}: ${launch
        .filter(k => !k.docs)
        .map(k => k.name)
        .join(
          ', ',
        )} — launch keys with no comment above them, in a bucket whose other keys have one. The table renders from the described keys, so these would be dropped from a list that reads as complete. Describe them at the declaration site.`,
    )
  }
  const head = described.length
    ? [
        '**Launch keys**, which name something to do on load rather than state the view holds:',
        '',
        markdownTable(
          ['Launch key', 'What it does'],
          described.map(
            k =>
              `| \`${k.name}\` | ${proseCell(withValues(k.name, k.docs, scan))} |`,
          ),
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
  // Every view type a launcher registers is one a session spec can open, so
  // every one of them needs a table. Read off the `LaunchView-<type>` registry
  // entries rather than a list here, which is the point: adding a launchable
  // view is how a view type comes to exist, and this fails that change until
  // the page documents it.
  //
  // A tagged bucket no page renders is caught by the same comparison from the
  // other end — the tag is a claim that the keys are documented somewhere.
  const undocumented = [
    ...new Set([
      ...scan.launchArgs.keys(),
      ...scan.buckets.map(b => b.viewType),
    ]),
  ].filter(v => !seen.has(v))
  if (undocumented.length) {
    throw new Error(
      `${undocumented.join(', ')} — a session spec can launch these, but no doc has a \`<!-- SPEC_KEYS <type> START -->\` marker for them, so what they accept is documented nowhere.`,
    )
  }
  return stale
}
