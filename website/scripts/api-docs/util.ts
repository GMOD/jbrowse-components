import * as ts from 'typescript'

import { pageDescription } from './markdown.ts'
import { parseSourceFileSyntactic } from './sourceCorpus.ts'

const cwd = `${process.cwd()}/`

// Strip the repo-root prefix off an absolute source path, e.g.
// /abs/repo/plugins/foo/src/x.ts -> plugins/foo/src/x.ts. Used everywhere a
// generator turns a TypeScript source filename into a repo-relative one for
// links and grouping.
export function repoRelative(filename: string) {
  return filename.replace(cwd, '')
}

// Turns a #category tag value (a bare camelCase word, e.g. "assemblyManagement")
// into a sidebar-friendly label ("Assembly Management"). Shared by the config and
// state-model generators so a new category tag needs no label-table update.
export function categoryLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
}

// The sidebar category for a config/model: an explicit #category tag wins, else
// the first matching name suffix from `suffixes` (checked in order), else
// "General". Shared by both generators so they only differ by their suffix table.
export function suffixCategory(
  name: string,
  explicit: string | undefined,
  suffixes: [suffix: string, category: string][],
): string {
  return explicit
    ? categoryLabel(explicit)
    : (suffixes.find(([suffix]) => name.endsWith(suffix))?.[1] ?? 'General')
}

// A slot's extracted source is a property assignment `<name>: <value>` (e.g.
// `bamLocation: { type: 'fileLocation', ... }`). The name already heads the slot
// section, so the leading `<name>:` is redundant noise in the code block — strip
// it and show just the value. Token-aware (via the TS scanner) so the colon
// inside a `'http://...'` URL or a nested defaultValue object is never mistaken
// for the assignment colon: only a `:` at bracket/brace/paren depth 0 counts.
export function stripPropertyName(code: string) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    ts.LanguageVariant.Standard,
    code,
  )
  let depth = 0
  let valueStart = -1
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken && valueStart < 0;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.OpenBraceToken ||
      token === ts.SyntaxKind.OpenBracketToken ||
      token === ts.SyntaxKind.OpenParenToken
    ) {
      depth++
    } else if (
      token === ts.SyntaxKind.CloseBraceToken ||
      token === ts.SyntaxKind.CloseBracketToken ||
      token === ts.SyntaxKind.CloseParenToken
    ) {
      depth--
    } else if (token === ts.SyntaxKind.ColonToken && depth === 0) {
      valueStart = scanner.getTokenEnd()
    }
  }
  return valueStart < 0
    ? code.trim()
    : dedentValue(code.slice(valueStart).trim())
}

// After dropping the `<name>:` prefix the value's first line (its opening `{`)
// sits at column 0 but the remaining lines keep the source's nesting
// indentation, leaving the body over-indented and the closing brace floating.
// Re-flush it: subtract the smallest indent among the trailing lines (the
// closing brace, which should align under the opening one) from each of them.
function dedentValue(value: string) {
  const [first, ...rest] = value.split('\n')
  const indents = rest
    .filter(line => line.trim())
    .map(line => line.length - line.trimStart().length)
  const dedent = indents.length ? Math.min(...indents) : 0
  return [first, ...rest.map(line => line.slice(dedent))].join('\n')
}

// Strip JSDoc/inline comments from extracted source. Token-aware (via the TS
// scanner) so `//` inside string literals — e.g. a `http://...` URL in a slot
// defaultValue or description — is preserved rather than truncated.
export function removeComments(string: string) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    ts.LanguageVariant.Standard,
    string,
  )
  let out = ''
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    const isComment =
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    if (!isComment) {
      out += scanner.getTokenText()
    }
  }
  return out.trim()
}

// Transitive closure of a node's documented parents — model composition or
// config derivation — in reading order (direct parents first, then theirs),
// deduped by id and cycle-safe. The graph shape lives here; each generator only
// supplies how to resolve a node's direct parents (`getParents`) and identity
// (`getId`). Mirrors how MST composition and config inheritance are both
// "follow the parent links and flatten" with different link sources.
export function collectTransitive<T>(
  root: T,
  getId: (node: T) => string,
  getParents: (node: T) => T[],
): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  const visit = (node: T) => {
    for (const parent of getParents(node)) {
      const id = getId(parent)
      if (!seen.has(id)) {
        seen.add(id)
        out.push(parent)
        visit(parent)
      }
    }
  }
  visit(root)
  return out
}

interface ComposeCall {
  // The compose call's own name literal, if it has one. A non-literal first
  // argument counts as a composed type, so a name held in a constant is read
  // off the `#stateModel` tag instead.
  name: string | undefined
  // Offset of the call, so a caller can attribute it to the `#stateModel` tag
  // above it.
  pos: number
  // The composed mixins, each reduced to the head identifier of its argument so
  // `TrackHeightMixin()` reads as `TrackHeightMixin`.
  mixins: string[]
}

function isComposeCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'compose'
  )
}

// The head identifier of each compose argument, so `TrackHeightMixin()` reads
// as `TrackHeightMixin`. An argument that is itself a `types.compose(...)` — the
// nesting a chain uses once it hits compose's ten-argument overload ceiling —
// contributes its own arguments in place.
function composeArgHeads(args: readonly ts.Expression[]): string[] {
  return args.flatMap(arg => {
    if (isComposeCall(arg)) {
      return composeArgHeads(arg.arguments)
    }
    let expr: ts.Expression = arg
    while (ts.isCallExpression(expr) || ts.isNonNullExpression(expr)) {
      expr = expr.expression
    }
    return ts.isIdentifier(expr) ? [expr.text] : []
  })
}

// Every `types.compose(['<name>',] A(), B(), types.model({}))` in a file.
//
// Two generated tables read composition — the display-foundations "Composes"
// column and the cross-cutting-mixin "Composed by" column — and they had a walk
// each, differing only in ways neither intended. The unwrap loop leaves
// `types.model({})` as a PropertyAccessExpression rather than an identifier, so
// the trailing empty model drops out on its own; the copy that additionally
// filtered `types` by name was filtering something that never reached it.
export function composeCalls(file: string, text?: string): ComposeCall[] {
  const out: ComposeCall[] = []
  const walk = (node: ts.Node) => {
    if (isComposeCall(node)) {
      const [first, ...rest] = node.arguments
      const named = first && ts.isStringLiteral(first)
      out.push({
        name: named ? first.text : undefined,
        pos: node.getStart(),
        mixins: composeArgHeads(named ? rest : node.arguments),
      })
    }
    ts.forEachChild(node, walk)
  }
  walk(parseSourceFileSyntactic(file, text))
  return out
}

// Keep only the items whose `name` isn't already in `seen`, and add each kept
// name to `seen` — so a caller walking outward through several sources (e.g. a
// config's base chain) shows each name once, at its closest/most-specific
// source, instead of repeating a shadowed definition from farther away.
export function filterUnseenByName<T extends { name: string }>(
  seen: Set<string>,
  items: T[],
): T[] {
  const fresh = items.filter(item => !seen.has(item.name))
  for (const item of fresh) {
    seen.add(item.name)
  }
  return fresh
}

// Fail hard when a second, differently-named #config/#stateModel tag turns up in
// a file that already documents one. Both accumulators key by filename and
// overwrite, so without this only the last header would render and the rest
// would vanish with no trace (this once silently dropped a whole model page) —
// far better to abort the run and make the author split the file. Shared by
// both accumulators.
export function assertSingleHeader({
  filename,
  tag,
  existing,
  incoming,
}: {
  filename: string
  tag: 'config' | 'stateModel'
  existing: string | undefined
  incoming: string
}) {
  if (existing && incoming && incoming !== existing) {
    throw new Error(
      `${filename}: multiple #${tag} tags ("${existing}" then "${incoming}"). The autogen documents one #${tag} per file, so all but the last would be silently dropped — move "${existing}" into its own file.`,
    )
  }
}

// The two coverage gaps both generators report after writing their pages: which
// headers carry no #example, and which fell back to the General category.
// Shared so the two passes can't diverge on what counts as a gap.
//
// Returned rather than warned. A console.warn fails nothing and scrolls past in
// a CI log, which is how 40 config pages and 90 model pages came to be bare —
// the driver commits these to a tracked file so each one is a reviewable line in
// the PR diff instead.
// `wantsExample` scopes the #example gap without scoping the General one. They
// are different questions about the same item — "should this page show a
// pasteable snippet" versus "did this fall out of every named category" — and a
// type exempt from the first is still a real gap under the second, so filtering
// `items` before the call (which is what the config pass used to do) quietly
// suppressed both.
export function headerGaps<T>({
  items,
  getName,
  getDocs,
  hasExample,
  wantsExample = () => true,
  isGeneralCategory,
}: {
  items: T[]
  getName: (item: T) => string
  getDocs: (item: T) => string
  hasExample: (item: T) => boolean
  wantsExample?: (item: T) => boolean
  isGeneralCategory: (item: T) => boolean
}) {
  return {
    noExample: items
      .filter(item => wantsExample(item) && !hasExample(item))
      .map(getName),
    noDescription: items
      .filter(item => !pageDescription(getDocs(item), ''))
      .map(getName),
    general: items.filter(isGeneralCategory).map(getName),
  }
}

// Narrow a by-file record to the entries that actually carry a #config/#stateModel
// header, with `header` typed non-optional. Both generators open their write pass
// with this filter.
export function withHeaders<T extends { header?: object }>(
  byFile: Record<string, T>,
): (T & { header: NonNullable<T['header']> })[] {
  return Object.values(byFile).filter(
    (v): v is T & { header: NonNullable<T['header']> } => Boolean(v.header),
  )
}

// Build a Map keyed by an accessor, dropping items whose key is undefined (last
// wins on collision, matching `new Map(entries)`). Shared by both generators'
// index construction: byDeclId from an optional declaration id, byName/bySlug
// from the always-present name/slug.
// Fail when two documented entities would write the same page, or answer to the
// same link slug.
//
// This is `assertSingleHeader` one scope out, with the same consequence and the
// same argument for being fatal. That one catches two differently-named
// `#config`/`#stateModel` blocks in ONE file, because the accumulators key by
// filename and the second overwrites the first. Across files nothing checked:
// the page path is built from the entity's name, so a name used twice writes
// one page twice and the loser vanishes with no diff (the page is still there,
// still current-looking, describing the other type). `mapByKey` last-wins the
// same way, so every "extends"/"composes" link that resolved through the name
// would quietly point at the survivor.
//
// The slug is checked alongside the name because links resolve through
// `slugify(name)`, and two names can differ while their slugs do not
// (`LinearGCContentDisplay` / `LinearGcContentDisplay`) — that pair renders two
// correct pages and cross-links them to whichever landed last.
export function assertUniquePages(
  kind: string,
  entities: { name: string; slug: string; filename: string }[],
) {
  const collisions = new Map<string, string[]>()
  for (const key of ['name', 'slug'] as const) {
    const byKey = new Map<string, string[]>()
    for (const e of entities) {
      byKey.set(e[key], [...(byKey.get(e[key]) ?? []), e.filename])
    }
    for (const [value, files] of byKey) {
      if (files.length > 1) {
        collisions.set(`${key} "${value}"`, files)
      }
    }
  }
  if (collisions.size) {
    throw new Error(
      `${collisions.size} ${kind} name/slug collision(s) — each would write one page for two types, and every link resolving through the name would point at whichever was generated last. Rename one of each pair:\n${[
        ...collisions,
      ]
        .map(([what, files]) => `  ${what}: ${files.join(', ')}`)
        .join('\n')}`,
    )
  }
}

export function mapByKey<T>(
  items: T[],
  key: (item: T) => string | undefined,
): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) {
    const k = key(item)
    if (k) {
      map.set(k, item)
    }
  }
  return map
}

// Resolve an entity by declaration id first, then by a name key, against the two
// index maps both generators keep — how a config's baseConfiguration and a
// model's composed ref each link back to the page that documents them.
export function lookupByIdOrName<T>(
  byDeclId: Map<string, T>,
  byName: Map<string, T>,
  declId: string | undefined,
  nameKey: string | undefined,
): T | undefined {
  return (
    (declId ? byDeclId.get(declId) : undefined) ??
    (nameKey ? byName.get(nameKey) : undefined)
  )
}
