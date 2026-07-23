import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

import * as ts from 'typescript'

const exec2 = promisify(exec)

const cwd = `${process.cwd()}/`

// Strip the repo-root prefix off an absolute source path, e.g.
// /abs/repo/plugins/foo/src/x.ts -> plugins/foo/src/x.ts. Used everywhere a
// generator turns a TypeScript source filename into a repo-relative one for
// links and grouping.
export function repoRelative(filename: string) {
  return filename.replace(cwd, '')
}

export type TagType = (typeof TAG_TYPES)[number]

export interface ExtractedNode {
  type: TagType
  name: string
  comment: string
  signature: string
  node: string
  filename: string
  // Stable identity of the declaration this node's symbol resolves to
  // ("file:pos"). Lets the config generator match a `baseConfiguration` against
  // the `#config` it derives from by declaration identity rather than textual
  // name — robust to default-export aliasing (e.g. a const `BaseConnectionConfig`
  // imported as `baseConnectionConfig`).
  selfDeclId?: string
  // For `#baseConfiguration` nodes only: the declId of the base config the
  // right-hand-side expression references (alias-followed). undefined when the
  // base can't be resolved statically (e.g. `pluginManager.getDisplayType(...)`).
  baseDeclId?: string
  // For `#baseConfiguration` nodes only: a string literal found in the RHS, used
  // as a name fallback when declId resolution fails — e.g.
  // `pluginManager.getDisplayType('LinearWiggleDisplay')!.configSchema` links to
  // the config named "LinearWiggleDisplay".
  baseConfigName?: string
  // For `#stateModel` nodes only: the models passed to this model's
  // `types.compose(...)` call, alias-followed. Lets the state-model generator
  // derive the composition graph from code instead of a hand-authored
  // `composed of` comment, the same way `baseDeclId` derives config inheritance.
  composedOf?: ComposedRef[]
}

// A model referenced inside a `types.compose(...)` call, identified two ways so
// the generator can match it back to the #stateModel page that documents it:
// by declaration identity (works when the #stateModel tag sits on the composed
// binding, e.g. `TrackHeightMixin`), and by resolved name (works when the tag
// sits on an inner factory whose result is re-exported, e.g.
// `export const BaseDisplay = stateModelFactory()`).
export interface ComposedRef {
  declId?: string
  name?: string
}

// A `trackType: 'X'` link declared on a `new DisplayType({ name, trackType })`
// registration — the only place in the codebase a Display says which Track it
// attaches to. Structural, not JSDoc-driven: a Display's index.ts registration
// carries no #config/#stateModel tag itself (those tags sit on the config/model
// factories it imports), so this can't piggyback on the tag pass above.
export interface DisplayTrackLink {
  displayName: string
  trackType: string
}

const TAG_TYPES = [
  'stateModel',
  'config',
  'api',
  'slot',
  'preProcessSnapshot',
  'identifier',
  'baseConfiguration',
  'property',
  'volatile',
  'getter',
  'action',
  'method',
] as const

// MST lifecycle hooks live in `.actions()` blocks but are not public API, so
// they are skipped during structural member detection.
const LIFECYCLE_HOOKS = new Set([
  'afterCreate',
  'afterAttach',
  'afterDetach',
  'beforeDestroy',
  'beforeDetach',
  'afterCreationFinalization',
])

export function extractWithComment(
  fileNames: string[],
  cb: (obj: ExtractedNode) => void,
  onDisplayLink: (link: DisplayTrackLink) => void,
  options: ts.CompilerOptions = {},
) {
  const program = ts.createProgram(fileNames, options)
  const checker = program.getTypeChecker()
  const blindSpots: BlindSpot[] = []
  const slotGaps: ConfigSlotGap[] = []

  for (const sourceFile of program.getSourceFiles()) {
    // Test files are excluded outright: their fixtures (a `#config` fixture
    // comment, a hand-built `new DisplayType(...)`) would otherwise be mistaken
    // for real documented entities or track/display links.
    const isTestFile = /\.test\.tsx?$/.test(sourceFile.fileName)
    if (!sourceFile.isDeclarationFile && !isTestFile) {
      // Structural member detection only runs in files that document a
      // #stateModel, and the untagged-slot audit only in files that document a
      // #config, so helper files with their own .actions() chains or internal
      // ConfigurationSchema calls don't contribute spurious members/gaps.
      const text = sourceFile.getFullText()
      const isStateModel = containsTag(text, 'stateModel')
      const isConfig = containsTag(text, 'config')
      ts.forEachChild(sourceFile, node => visit(node, isStateModel, isConfig))
    }
  }
  reportBlindSpots(blindSpots)
  reportConfigSlotGaps(slotGaps)

  function visit(node: ts.Node, isStateModel: boolean, isConfig: boolean) {
    const link = displayTrackLink(node)
    if (link) {
      onDisplayLink(link)
    }
    if (isConfig) {
      collectUntaggedSlots(node, slotGaps)
    }
    const comment = getOwnJSDocText(node)
    const tags = comment ? TAG_TYPES.filter(t => containsTag(comment, t)) : []
    if (tags.length) {
      const { name, signature, declId } = describeSymbol(checker, node)
      const base = {
        name,
        comment,
        signature,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
        selfDeclId: declId,
        baseDeclId: tags.includes('baseConfiguration')
          ? resolveBaseConfigDeclId(checker, node)
          : undefined,
        baseConfigName:
          tags.includes('baseConfiguration') && ts.isPropertyAssignment(node)
            ? findStringLiteral(node.initializer)
            : undefined,
        composedOf: tags.includes('stateModel')
          ? resolveComposedModels(checker, node)
          : undefined,
      }
      for (const type of tags) {
        cb({ type, ...base })
      }
    } else if (isStateModel) {
      // Untagged members are recovered structurally from their position in the
      // MST factory chain. A node either has a tag (handled above, unchanged) or
      // is examined here, so no member is ever emitted twice.
      emitUntaggedMember(checker, node, comment, cb, blindSpots)
    }
    ts.forEachChild(node, n => visit(n, isStateModel, isConfig))
  }
}

// A config slot that a #config schema declares but never tags with #slot, so it
// is silently absent from the generated docs (the failure mode that hid
// configuration.shareURL when its comment used /* instead of /**).
interface ConfigSlotGap {
  filename: string
  schema: string
  slot: string
}

function isConfigurationSchemaCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'ConfigurationSchema'
  )
}

// Audit one `ConfigurationSchema('Name', { ...slots })` call: every own property
// of the slots object should carry a #slot tag. A property whose value is itself
// an inline `ConfigurationSchema(...)` is a grouping sub-schema (its children are
// the slots, e.g. hierarchical.sort), so it is skipped; spreads (plugin/extra
// slot injection) are skipped too.
function collectUntaggedSlots(node: ts.Node, gaps: ConfigSlotGap[]) {
  if (isConfigurationSchemaCall(node)) {
    const schema = ts.isStringLiteralLike(node.arguments[0])
      ? node.arguments[0].text
      : '(anonymous)'
    const slots = node.arguments[1]
    if (slots && ts.isObjectLiteralExpression(slots)) {
      for (const prop of slots.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          !isConfigurationSchemaCall(prop.initializer) &&
          !containsTag(jsDocText(prop), 'slot')
        ) {
          gaps.push({
            filename: prop.getSourceFile().fileName,
            schema,
            slot: prop.name.text,
          })
        }
      }
    }
  }
}

function reportConfigSlotGaps(gaps: ConfigSlotGap[]) {
  if (gaps.length) {
    console.warn(
      `${gaps.length} config slot(s) in a #config schema have no #slot tag, so they are silently missing from the generated docs. Add a /** #slot */ comment (a single-star /* comment is ignored):`,
    )
    const byFile = new Map<string, ConfigSlotGap[]>()
    for (const gap of gaps) {
      const file = repoRelative(gap.filename)
      byFile.set(file, [...(byFile.get(file) ?? []), gap])
    }
    for (const [file, list] of byFile) {
      console.warn(
        `  ${file}: ${list.map(g => `${g.schema}.${g.slot}`).join(', ')}`,
      )
    }
  }
}

// A member that sits in an MST block but the structural pass can't document and
// no tag rescued: an untagged `{ foo }` shorthand returning a local function in
// .views()/.actions(). Surfaced as a warning so the gap is visible, not silent.
interface BlindSpot {
  filename: string
  kind: MemberBlock
  name: string
}

// Emit an ExtractedNode for an untagged MST member, classified by which block of
// the factory chain encloses it. Tagged members never reach here, so this only
// fills the documentation gaps that hand-written tags missed. Members in a block
// that resist structural classification are recorded as blind spots instead.
function emitUntaggedMember(
  checker: ts.TypeChecker,
  node: ts.Node,
  comment: string,
  cb: (obj: ExtractedNode) => void,
  blindSpots: BlindSpot[],
) {
  const block = enclosingMemberBlock(node)
  if (!block) {
    return
  }
  const type = memberType(node, block)
  if (type) {
    const { name, signature, declId } = describeSymbol(checker, node)
    if (name && !(block === 'actions' && LIFECYCLE_HOOKS.has(name))) {
      cb({
        type,
        name,
        comment,
        signature,
        node: node.getFullText(),
        filename: node.getSourceFile().fileName,
        selfDeclId: declId,
      })
    }
  } else if (
    (block === 'views' || block === 'actions') &&
    ts.isShorthandPropertyAssignment(node) &&
    isUndocumentedLocal(checker, node)
  ) {
    blindSpots.push({
      filename: node.getSourceFile().fileName,
      kind: block,
      name: node.name.text,
    })
  }
}

// True when a `{ foo }` shorthand's target declaration carries no member tag, so
// the tag pass didn't already document it from the declaration. Tagged
// local-function returns (e.g. LinearGenomeView `slide`/`zoom`) are excluded.
function isUndocumentedLocal(
  checker: ts.TypeChecker,
  node: ts.ShorthandPropertyAssignment,
) {
  const symbol = checker.getShorthandAssignmentValueSymbol(node)
  const decl = symbol?.valueDeclaration ?? symbol?.declarations?.[0]
  const doc = decl ? getOwnJSDocText(decl) : ''
  return !MEMBER_TAGS.some(t => containsTag(doc, t))
}

function reportBlindSpots(blindSpots: BlindSpot[]) {
  if (blindSpots.length) {
    const byFile = new Map<string, BlindSpot[]>()
    for (const spot of blindSpots) {
      const file = repoRelative(spot.filename)
      byFile.set(file, [...(byFile.get(file) ?? []), spot])
    }
    console.warn(
      `${blindSpots.length} undocumented member(s) the autogen can't auto-detect (untagged shorthand returns of local functions). Add a #getter/#method/#action tag to the local declaration to document:`,
    )
    for (const [file, spots] of byFile) {
      console.warn(`  ${file}: ${spots.map(s => s.name).join(', ')}`)
    }
  }
}

const MEMBER_TAGS = [
  'property',
  'volatile',
  'getter',
  'method',
  'action',
] as const

type MemberBlock = 'property' | 'volatile' | 'views' | 'actions'

// The MST member block a call introduces, or undefined. `types.model({...})`
// carries the persisted properties; `.volatile()`, `.views()`, and `.actions()`
// each contribute their named kind. Detected structurally so members need no
// per-member JSDoc tag to be documented.
function memberBlockKind(node: ts.Node): MemberBlock | undefined {
  if (!ts.isCallExpression(node)) {
    return undefined
  }
  if (isTypesMember(node.expression, 'model')) {
    return 'property'
  }
  if (ts.isPropertyAccessExpression(node.expression)) {
    const name = node.expression.name.text
    if (name === 'volatile' || name === 'views' || name === 'actions') {
      return name
    }
  }
  return undefined
}

// The object literal a member block exposes: the last object-literal argument of
// `types.model(...)`, or the object returned by a `self => ({...})` /
// `() => {...; return {...}}` callback for volatile/views/actions.
function memberObjectLiteral(node: ts.CallExpression, kind: MemberBlock) {
  if (kind === 'property') {
    return node.arguments.findLast(ts.isObjectLiteralExpression)
  }
  const cb = node.arguments.at(-1)
  return cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))
    ? returnedObjectLiteral(cb)
    : undefined
}

// The object literal a callback yields, covering both the concise
// `self => ({...})` body and the `self => { ...; return {...} }` block body.
function returnedObjectLiteral(fn: ts.FunctionLikeDeclaration) {
  const body = fn.body
  const expr =
    body && ts.isBlock(body)
      ? body.statements.find(ts.isReturnStatement)?.expression
      : body
  const unwrapped =
    expr && ts.isParenthesizedExpression(expr) ? expr.expression : expr
  return unwrapped && ts.isObjectLiteralExpression(unwrapped)
    ? unwrapped
    : undefined
}

// The MemberBlock whose members object directly contains `node`, or undefined.
// Climbs from the node's parent object literal through the callback wrappers
// (parens, arrow/function body, block return) to the owning chain call, then
// confirms that object literal really is that block's members object — so an
// unrelated object literal nested inside a member's body is not mistaken for a
// member block.
function enclosingMemberBlock(node: ts.Node): MemberBlock | undefined {
  const obj = node.parent
  if (!ts.isObjectLiteralExpression(obj)) {
    return undefined
  }
  let cur: ts.Node = obj.parent
  while (
    ts.isParenthesizedExpression(cur) ||
    ts.isReturnStatement(cur) ||
    ts.isBlock(cur) ||
    ts.isArrowFunction(cur) ||
    ts.isFunctionExpression(cur)
  ) {
    cur = cur.parent
  }
  if (ts.isCallExpression(cur)) {
    const kind = memberBlockKind(cur)
    if (kind && memberObjectLiteral(cur, kind) === obj) {
      return kind
    }
  }
  return undefined
}

// The documented kind of one object-literal member within a given block, or
// undefined for members that aren't documentable API (spreads, setters, plain
// non-function values, and the shorthand `{ slide }` returns whose tagged
// declaration the tag pass already emitted).
function memberType(node: ts.Node, kind: MemberBlock): TagType | undefined {
  const isField =
    ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)
  if (kind === 'property') {
    return isField ? 'property' : undefined
  }
  if (kind === 'volatile') {
    return isField ? 'volatile' : undefined
  }
  const isFn =
    ts.isMethodDeclaration(node) ||
    (ts.isPropertyAssignment(node) &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer)))
  if (kind === 'views') {
    return ts.isGetAccessorDeclaration(node)
      ? 'getter'
      : isFn
        ? 'method'
        : undefined
  }
  return isFn ? 'action' : undefined
}

function describeSymbol(checker: ts.TypeChecker, node: ts.Node) {
  const nameNode = getNameNode(node)
  const symbol = nameNode ? checker.getSymbolAtLocation(nameNode) : undefined
  const decl = symbol?.valueDeclaration
  return {
    name: symbol?.getName() ?? '',
    signature: symbol && decl ? typeSignature(checker, symbol, decl) : '',
    declId: symbolDeclId(checker, symbol),
  }
}

// A member's rendered type. `typeToString` truncates past ~340 characters by
// cutting mid-token — leaving unbalanced brackets and half a word, which is
// worse than no type at all (a display's `configuration` printed 340 characters
// of expanded config schema ending in "including c..."). When that happens,
// re-render untruncated and shorten structurally instead, so the type still
// reads as a type.
function typeSignature(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  decl: ts.Declaration,
) {
  const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
  const printed = checker.typeToString(type)
  return elideSignature(
    printed.endsWith('...')
      ? checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
      : printed,
  )
}

// Longer than this and a signature stops being read and starts being skipped.
const MAX_SIGNATURE = 180

// The innermost `<...>` / `{...}` group in a type string, or undefined. Already
// elided groups (`<…>`, `{…}`) are atomic: skipped when scanning, so the next
// pass finds the group that encloses them. The `>` of a `=>` is not a bracket.
function innermostGroup(sig: string, open: string, close: string) {
  const elided = `${open}…${close}`
  for (let i = 0; i < sig.length; i++) {
    if (sig.startsWith(elided, i)) {
      i += 2
    } else if (sig[i] === open) {
      for (let j = i + 1; j < sig.length; j++) {
        if (sig.startsWith(elided, j)) {
          j += 2
        } else if (sig[j] === open) {
          break
        } else if (sig[j] === close && !(close === '>' && sig[j - 1] === '=')) {
          return { start: i + 1, end: j }
        }
      }
    }
  }
  return undefined
}

// Split a type on its top-level `|`, ignoring the ones nested inside brackets —
// so a union of four object types splits into four, but a function type whose
// parameter happens to be `boolean | undefined` stays whole.
function topLevelUnion(sig: string) {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < sig.length; i++) {
    const c = sig[i]!
    if ('<{(['.includes(c)) {
      depth++
    } else if ('>})]'.includes(c)) {
      if (!(c === '>' && sig[i - 1] === '=')) {
        depth--
      }
    } else if (c === '|' && depth === 0) {
      parts.push(sig.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(sig.slice(start).trim())
  return parts
}

// Shorten an over-long type structurally, never by cutting characters: the point
// is that what is printed still reads as a type. Generic arguments collapse from
// the inside out first — `FC<{ model: ModelInstanceTypeProps<Record<string,
// any>> }>` loses the `Record` before the object — then inline object types, then
// a top-level union drops its trailing alternatives. Each stage stops as soon as
// the type fits, so it gives up the least specific detail it can.
//
// A type that resists all three is left alone. An honest long signature beats a
// mangled short one: truncating this one at a fixed width once ate a function's
// entire return type, leaving it ending mid-parameter.
export function elideSignature(sig: string, max = MAX_SIGNATURE) {
  let out = sig.replace(/\s+/g, ' ')
  for (const [open, close] of [
    ['<', '>'],
    ['{', '}'],
  ]) {
    while (out.length > max) {
      const group = innermostGroup(out, open!, close!)
      if (!group) {
        break
      }
      out = `${out.slice(0, group.start)}…${out.slice(group.end)}`
    }
  }
  if (out.length > max) {
    const parts = topLevelUnion(out)
    const kept = parts.filter(
      (_, i) => i === 0 || parts.slice(0, i + 1).join(' | ').length + 4 <= max,
    )
    out = kept.length < parts.length ? `${kept.join(' | ')} | …` : out
  }
  return out
}

// The first sentence of a description, for table cells: the full multi-sentence
// text lives in the entry the row links into, and a paragraph in a cell forces
// horizontal scroll and defeats the scan. `e.g.`/`i.e.` are not sentence ends.
export function firstSentence(text: string) {
  const trimmed = text.trim()
  const match = /^.*?[.!?](?<!\b[ei]\.[a-z]\.)(?=\s|$)/s.exec(trimmed)
  return match ? match[0] : trimmed
}

// Follow import aliases to the original symbol so two references to the same
// declaration (under different local/imported names) resolve identically.
function followAlias(checker: ts.TypeChecker, symbol: ts.Symbol) {
  let s = symbol
  while (s.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(s)
    if (aliased === s) {
      break
    }
    s = aliased
  }
  return s
}

// "file:pos" of the declaration a symbol resolves to, alias-followed.
function symbolDeclId(checker: ts.TypeChecker, symbol: ts.Symbol | undefined) {
  if (!symbol) {
    return undefined
  }
  const s = followAlias(checker, symbol)
  const decl = s.declarations?.[0] ?? s.valueDeclaration
  return decl
    ? `${decl.getSourceFile().fileName}:${decl.getStart()}`
    : undefined
}

// For a `baseConfiguration: <expr>` property, the declId of the base config the
// expr references. Peels call/non-null wrappers to the head identifier
// (`createBaseTrackConfig(pm)` -> `createBaseTrackConfig`); returns undefined for
// non-identifier heads like `pluginManager.getDisplayType(...)`.
function resolveBaseConfigDeclId(checker: ts.TypeChecker, node: ts.Node) {
  if (!ts.isPropertyAssignment(node)) {
    return undefined
  }
  let expr: ts.Expression = node.initializer
  while (ts.isNonNullExpression(expr) || ts.isCallExpression(expr)) {
    expr = expr.expression
  }
  return ts.isIdentifier(expr)
    ? symbolDeclId(checker, checker.getSymbolAtLocation(expr))
    : undefined
}

// The models a `#stateModel` declaration composes. Two patterns are covered:
//
//   A. `types.compose('Name', Base, Mixin(), types.model({...}))` — each
//      argument is resolved (alias-followed); `Mixin` resolves directly,
//      `Mixin(args)` reduces to its head identifier, and the string-literal name
//      and inline `types.model(...)` (any `types.*` literal) yield no identifier
//      and are skipped.
//   B. `return BaseFactory(args).views(...).actions(...)` — a model built by
//      extending another factory's result rather than composing. The base is the
//      head identifier of the factory's own returned chain.
//
// Deduped by declId/name, in source order. Requires the #stateModel JSDoc to sit
// on the model's factory (or its `types.compose`), not an unrelated preceding
// declaration.
function resolveComposedModels(checker: ts.TypeChecker, node: ts.Node) {
  const out: ComposedRef[] = []
  const seen = new Set<string>()
  const add = (ref: ComposedRef | undefined) => {
    const key = ref && (ref.declId ?? ref.name)
    if (ref && key && !seen.has(key)) {
      seen.add(key)
      out.push(ref)
    }
  }
  const walk = (n: ts.Node) => {
    if (ts.isCallExpression(n) && isTypesMember(n.expression, 'compose')) {
      for (const arg of n.arguments) {
        add(composedArgRef(checker, arg))
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(node)
  add(returnedBaseRef(checker, node))
  return out
}

// Pattern B: the base factory a model extends by chaining `.views()/.actions()/
// ...` onto another factory's result. Peels the factory's own returned method
// chain to the root call and returns its callee when it is a bare identifier.
// `types.compose(...)` / `types.model(...)` roots return undefined (compose is
// handled by the walk above; a plain model has no base).
function returnedBaseRef(checker: ts.TypeChecker, node: ts.Node) {
  const fn = factoryFunction(node)
  const ret = fn && returnedExpression(fn)
  if (!ret) {
    return undefined
  }
  let expr: ts.Expression = ret
  while (
    ts.isCallExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression) &&
    ts.isCallExpression(expr.expression.expression)
  ) {
    expr = expr.expression.expression
  }
  return ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)
    ? identifierRef(checker, expr.expression)
    : undefined
}

// The function a #stateModel JSDoc annotates: the declaration itself, or the
// arrow/function initializer of a `const Factory = (...) => {...}`.
function factoryFunction(node: ts.Node) {
  if (ts.isFunctionDeclaration(node)) {
    return node
  }
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer))
  ) {
    return node.initializer
  }
  return undefined
}

// The expression a factory returns: an arrow's expression body, or the first
// top-level `return` in a block body (nested returns inside view/action
// callbacks are intentionally ignored).
function returnedExpression(fn: ts.FunctionLikeDeclaration) {
  const body = fn.body
  if (body && !ts.isBlock(body)) {
    return body
  }
  return body?.statements.find(ts.isReturnStatement)?.expression
}

// True for a `types.<name>` property access — the MST namespace import used
// throughout the codebase (`types.compose`, `types.model`).
function isTypesMember(expr: ts.Expression, name: string) {
  return (
    ts.isPropertyAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 'types' &&
    expr.name.text === name
  )
}

// Resolve one `types.compose` argument: peel call/non-null wrappers to the head
// expression, then resolve only if it is a bare identifier. `types.model(...)`
// peels to the `types.model` property access (not an identifier) and so returns
// undefined.
function composedArgRef(
  checker: ts.TypeChecker,
  arg: ts.Expression,
): ComposedRef | undefined {
  let expr: ts.Expression = arg
  while (ts.isCallExpression(expr) || ts.isNonNullExpression(expr)) {
    expr = expr.expression
  }
  return ts.isIdentifier(expr) ? identifierRef(checker, expr) : undefined
}

// Resolve an identifier naming a composed/base model to a ComposedRef, returning
// both declId and alias-followed name so the generator can match on either. When
// it resolves to a `const X = Factory(...)` — the common "export the factory's
// result" shape, and the `const base = factory(schema)` local that's then
// composed — follow the initializer to the factory identifier, which carries the
// #stateModel tag so its declId matches the model's page.
function identifierRef(
  checker: ts.TypeChecker,
  id: ts.Identifier,
  depth = 0,
): ComposedRef | undefined {
  const symbol = checker.getSymbolAtLocation(id)
  if (!symbol) {
    return undefined
  }
  const aliased = followAlias(checker, symbol)
  const decl = aliased.declarations?.[0]
  if (depth < 3 && decl && ts.isVariableDeclaration(decl) && decl.initializer) {
    let init: ts.Expression = decl.initializer
    while (ts.isCallExpression(init) || ts.isNonNullExpression(init)) {
      init = init.expression
    }
    const followed = ts.isIdentifier(init)
      ? identifierRef(checker, init, depth + 1)
      : undefined
    if (followed) {
      return followed
    }
  }
  return { declId: symbolDeclId(checker, aliased), name: aliased.getName() }
}

// First string literal anywhere in an expression (depth-first). Used to recover
// a config name from a dynamic `getDisplayType('Name')` base reference.
function findStringLiteral(node: ts.Node): string | undefined {
  let found: string | undefined
  const walk = (n: ts.Node) => {
    if (found === undefined) {
      if (ts.isStringLiteral(n)) {
        found = n.text
      } else {
        ts.forEachChild(n, walk)
      }
    }
  }
  walk(node)
  return found
}

// Matches `new DisplayType({ name: 'X', trackType: 'Y', ... })` — the only
// place in the codebase a Display declares which Track it attaches to. Plain
// structural pattern match, not tied to any import path, so it also catches a
// default-imported local alias.
function displayTrackLink(node: ts.Node): DisplayTrackLink | undefined {
  if (
    !ts.isNewExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== 'DisplayType' ||
    !node.arguments?.length
  ) {
    return undefined
  }
  const arg = node.arguments[0]!
  if (!ts.isObjectLiteralExpression(arg)) {
    return undefined
  }
  const displayName = stringPropValue(arg, 'name')
  const trackType = stringPropValue(arg, 'trackType')
  return displayName && trackType ? { displayName, trackType } : undefined
}

// The string-literal value of a `key: '...'` property in an object literal, or
// undefined when the property is absent or not a plain string literal.
function stringPropValue(obj: ts.ObjectLiteralExpression, key: string) {
  const prop = obj.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === key,
  )
  return prop && ts.isStringLiteral(prop.initializer)
    ? prop.initializer.text
    : undefined
}

// True when `text` contains the JSDoc tag `#name` as a whole token, i.e. not as
// a prefix of a longer word — so `#getter` does not match `#getterById`, nor
// `#category` match `#categoryManagement`. Used both for the whole-comment tag
// scan and the per-line parse in parseTaggedComment.
export function containsTag(text: string, name: string) {
  return new RegExp(`#${name}(?![A-Za-z0-9_])`).test(text)
}

function getNameNode(node: ts.Node): ts.Node | undefined {
  if (
    'name' in node &&
    node.name &&
    typeof node.name === 'object' &&
    'kind' in node.name
  ) {
    return node.name as ts.Node
  }
  return undefined
}

// A `{@link Foo}` part parses as a JSDocLink node whose `text` holds only what
// follows the target (a label, or nothing), with the target itself in `name` —
// so reading `.text` alone silently deletes the word from the sentence
// ("Composes the shared {@link EmbeddedRootModel} with ..." rendered as
// "Composes the shared with ..."). Re-emit the target, and prefer an explicit
// `{@link Foo|label}` / `{@link Foo label}` label when the author wrote one.
function jsDocPartText(part: ts.JSDocComment): string {
  if (
    ts.isJSDocLink(part) ||
    ts.isJSDocLinkCode(part) ||
    ts.isJSDocLinkPlain(part)
  ) {
    // `{@link https://x}` parses as name `https` + text `://x`, so text only
    // counts as a label when a `|` or space separates it from the target
    const label = /^[|\s]/.test(part.text)
      ? part.text.replace(/^[|\s]+/, '')
      : ''
    return label || (part.name?.getText() ?? '') + part.text
  }
  return part.text
}

// Flatten the comment bodies of a node's `jsDoc` parser array into one string. A
// JSDoc comment is either a plain string or an array of parts (when it contains
// `{@link}`-style nodes), so both shapes are normalized here. Shared by every
// place that reads JSDoc text off a node.
export function jsDocText(node: ts.Node): string {
  const jsDoc = (node as { jsDoc?: ts.JSDoc[] }).jsDoc
  return (jsDoc ?? [])
    .map(jd =>
      typeof jd.comment === 'string'
        ? jd.comment
        : (jd.comment?.map(p => jsDocPartText(p)).join('') ?? ''),
    )
    .join('\n')
}

// JSDoc body text directly attached to this node (not inherited from
// ancestors). Uses the internal `jsDoc` parser property — unlike
// `getJSDocCommentsAndTags`, this does not walk up, so reference nodes like
// PropertyAccessExpression do not inherit JSDoc from their enclosing
// declaration.
//
// For VariableDeclaration, the JSDoc above `const Foo = ...` attaches to the
// parent VariableStatement, so we look there instead.
function getOwnJSDocText(node: ts.Node): string {
  return jsDocText(ts.isVariableDeclaration(node) ? node.parent.parent : node)
}

export interface Example {
  label: string
  content: string
}

// Extracts the entity name, human-readable description, and optional example
// usage from a comment body like:
//   #stateModel LinearGenomeView
//   #category view
//   The actual description...
//   #example
//   ```js
//   const state = createViewState({ ... })
//   ```
// Multiple #example blocks are supported; an optional label follows the tag
// (#example minimal, #example full). An optional #trackType tag (on adapter
// #config blocks) names the track type the example should be wrapped in.
// An optional #gotcha tag captures a footgun that a reader configuring this
// type has to know but would not infer from the slot list (e.g. that
// MultiWiggleAdapter's `bigWigs` array only accepts absolute URLs); its text
// runs to the next tag, so it may wrap across lines.
// Returns { name, category, trackType, docs, gotchas, examples }.
// Examples are authored LAST so they stay out of the prose `docs` and any
// legacy `extends`/`composed of` block that stripComposedBlock removes.
export function parseTaggedComment(
  comment: string,
  type: TagType,
  fallbackName: string,
) {
  const tag = `#${type}`
  const lines = comment.split('\n')
  let name = fallbackName
  let category: string | undefined
  let trackType: string | undefined
  const docs: string[] = []
  const examples: Example[] = []
  const gotchas: string[] = []
  let current: { label: string; lines: string[] } | undefined
  let currentGotcha: string[] | undefined
  // A #gotcha runs to the next tag or the next blank line, whichever comes
  // first, so it can wrap across lines without a terminator and without
  // swallowing the description prose that follows it. Its own line breaks are
  // collapsed, since they are comment wrapping rather than markdown structure —
  // prettier rewraps the rendered callout to the doc's width.
  const endGotcha = () => {
    if (currentGotcha) {
      const text = currentGotcha.join(' ').replaceAll(/\s+/g, ' ').trim()
      if (text) {
        gotchas.push(text)
      }
      currentGotcha = undefined
    }
  }
  for (const line of lines) {
    if (containsTag(line, 'example')) {
      endGotcha()
      if (current) {
        examples.push({
          label: current.label,
          content: current.lines.join('\n').trim(),
        })
      }
      current = { label: line.replace(/.*#example\s*/, '').trim(), lines: [] }
    } else if (containsTag(line, type)) {
      endGotcha()
      const fromTag = line.replace(tag, '').trim()
      if (fromTag) {
        name = fromTag
      }
    } else if (containsTag(line, 'category')) {
      endGotcha()
      category = line.replace(/.*#category\s*/, '').trim() || undefined
    } else if (containsTag(line, 'trackType')) {
      endGotcha()
      trackType = line.replace(/.*#trackType\s*/, '').trim() || undefined
    } else if (containsTag(line, 'fileFormat')) {
      // Consumed by generateFileTypeDocs (the format -> adapter tables in the
      // file types guide). Dropped here so it doesn't leak into the config
      // page's prose.
      endGotcha()
    } else if (
      containsTag(line, 'displayFoundation') ||
      containsTag(line, 'displayFoundationDef')
    ) {
      // Consumed by generateDisplayFoundationDocs (the foundations table in the
      // creating_display guide). Dropped here for the same reason as
      // #fileFormat above.
      endGotcha()
    } else if (containsTag(line, 'gotcha')) {
      endGotcha()
      currentGotcha = [line.replace(/.*#gotcha\s*/, '')]
    } else if (currentGotcha) {
      if (line.trim()) {
        currentGotcha.push(line)
      } else {
        endGotcha()
      }
    } else if (current) {
      current.lines.push(line)
    } else {
      docs.push(line)
    }
  }
  endGotcha()
  if (current) {
    examples.push({
      label: current.label,
      content: current.lines.join('\n').trim(),
    })
  }
  return {
    name,
    category,
    trackType,
    docs: docs.join('\n'),
    gotchas,
    examples,
  }
}

export interface ParsedNode {
  name: string
  docs: string
  examples: Example[]
  // `#gotcha <text>` blocks — footguns rendered as a caution callout on the
  // generated page, so a warning lives at the definition site rather than in a
  // hand-written guide that silently goes stale
  gotchas: string[]
  category?: string
  // `#trackType <TrackType>` on an adapter's #config — the track type its
  // example should be wrapped in (see wrapAdapterExample in generateConfigDocs)
  trackType?: string
  code: string
  signature: string
}

// Parse one extracted node into the fields the config and state-model generators
// both build their Item/Member records from: the tag-parsed name/docs/examples/
// category, plus the comment-stripped source and type signature. Shared so the
// two near-identical buildItem/buildMember helpers don't drift.
export function parseNode(obj: ExtractedNode): ParsedNode {
  const { name, docs, examples, gotchas, category, trackType } =
    parseTaggedComment(obj.comment, obj.type, obj.name)
  return {
    name,
    docs,
    examples,
    gotchas,
    category,
    trackType,
    code: removeComments(obj.node),
    signature: obj.signature,
  }
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

// Parse a source file syntactically (no type checker / program), for the
// marker-block generators (color/jexl) that only read JSDoc text and
// string-literal initializers — keeping them independent of the file's heavy
// runtime imports (e.g. theme.ts's MUI).
export function parseSourceFileSyntactic(file: string) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
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

// Shared markdown builders used by both generators.
export function codeBlock(...lines: string[]) {
  return ['```js', ...lines, '```'].join('\n')
}

// Flatten free-form JSDoc prose into one safe table cell: collapse newlines
// (a pipe table row can't span lines) and escape markdown metacharacters used
// here: backslash (escape char) and literal `|` (table column separator).
export function tableCell(text: string | undefined) {
  return (text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim()
}

// A GFM pipe table: header cells, then one already-built `| a | b | c |` row
// per entry. Rows are joined with a single newline (not `section`'s blank-line
// join) since a table's rows must be consecutive lines with no gaps.
export function markdownTable(headers: string[], rows: string[]) {
  return rows.length
    ? [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows,
      ].join('\n')
    : ''
}

// A member's documented type is a bare type expression. Emitting it on its own
// line in a ```js block lets prettier parse it as a statement, so e.g. an object
// type followed by `[]` gets ASI-split into a `;[]` line. Wrapping it as a
// `type` alias in a ```ts block keeps prettier in type position, where it
// formats correctly.
export function typeAliasBlock(name: string, signature: string) {
  return ['```ts', `type ${name} = ${signature}`, '```'].join('\n')
}

// Properties/volatiles document both a type and the source line that declares
// them. The source (`name: value`) is a labeled statement that prettier leaves
// alone, but the type alias still has to carry the type to avoid the same
// statement-position mangling typeAliasBlock guards against.
export function typeAndCodeBlock(
  name: string,
  signature: string,
  code: string,
) {
  return [
    '```ts',
    '// type signature',
    `type ${name} = ${signature}`,
    '// code',
    code,
    '```',
  ].join('\n')
}

// The shared skeleton every generated config/model page wears: frontmatter, a
// one-line auto-generated preamble that folds in the source-code
// link, then the page body. The config and model generators differ only in
// `notes` and `sourcePath`, so the skeleton lives here to stay single-sourced.
export function docPage({
  id,
  title,
  sidebarLabel,
  notes,
  sourcePath,
  body,
}: {
  id: string
  title: string
  sidebarLabel: string
  notes: string
  sourcePath: string
  body: string
}) {
  const intro = [
    notes,
    provenance(sourcePath),
    `[View source](https://github.com/GMOD/jbrowse-components/blob/main/${sourcePath}).`,
  ]
    .filter(Boolean)
    .join(' ')
  return `---
id: ${id}
title: ${title}
sidebar_label: ${sidebarLabel}
---

${intro}

${body}
`
}

// Where a documented element comes from, derived from its source path: which
// plugin provides it (the actionable fact — that plugin must be present), or
// that it is built into JBrowse core. Empty for anything else (e.g. products).
function provenance(sourcePath: string): string {
  const [workspace, name] = sourcePath.split('/')
  return workspace === 'plugins' && name
    ? `Provided by the \`${name}\` plugin.`
    : workspace === 'packages' && name
      ? 'Built into JBrowse core.'
      : ''
}

// Fail hard when a second, differently-named #config/#stateModel tag turns up in
// a file that already documents one. Both accumulators key by filename and
// overwrite, so without this only the last header would render and the rest
// would vanish with no trace (this once silently dropped a whole model page) —
// far better to abort the run and make the author split the file.
// A #config/#stateModel const is tagged twice (the VariableStatement and its
// inner declaration); the statement half resolves to an empty name when the tag
// carries none, so an empty `incoming` never trips this — only two non-empty,
// differing names do. Shared by both accumulators.
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

// Logs a coverage-gap warning shared by both generators' write*Docs entry
// points, e.g. "6/102 configs have no #example: Foo, Bar" or
// "8/95 models resolved to the General category: Foo, Bar". Silent when
// `items` is empty, so a fully-covered run prints nothing.
export function warnCoverageGap<T>({
  items,
  total,
  kind,
  reason,
  getName,
}: {
  items: T[]
  total: number
  kind: string
  reason: string
  getName: (item: T) => string
}) {
  if (items.length) {
    console.warn(
      `${items.length}/${total} ${kind} ${reason}: ${items.map(getName).join(', ')}`,
    )
  }
}

// The two coverage warnings both generators emit after writing their pages:
// which headers carry no #example, and which fell back to the General category.
// Shared so the reason strings can't drift between the config and model passes.
export function warnHeaderGaps<T>({
  items,
  kind,
  getName,
  hasExample,
  isGeneralCategory,
}: {
  items: T[]
  kind: string
  getName: (item: T) => string
  hasExample: (item: T) => boolean
  isGeneralCategory: (item: T) => boolean
}) {
  warnCoverageGap({
    items: items.filter(item => !hasExample(item)),
    total: items.length,
    kind,
    reason: 'have no #example',
    getName,
  })
  warnCoverageGap({
    items: items.filter(isGeneralCategory),
    total: items.length,
    kind,
    reason: 'resolved to the General category (consider adding #category)',
    getName,
  })
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

// Join non-empty parts with blank lines between them. Falsy parts (including the
// `0` from `arr.length && ...`) are dropped, so empty sections vanish cleanly.
export function section(...parts: (string | false | 0 | undefined)[]) {
  return parts.filter(Boolean).join('\n\n')
}

// Wraps content in an `## Overview` section. Returns empty string when all
// parts are falsy, so no stray heading appears. On a sparse page whose whole
// overview is a single prose paragraph (no sub-headings or `<details>`
// sections), the `## Overview` heading outweighs its content, so the prose is
// emitted bare.
export function overviewSection(...parts: (string | false | 0 | undefined)[]) {
  const body = section(...parts)
  const hasSections = /(^|\n)(#{2,6} |<details)/.test(body)
  return body ? (hasSections ? `## Overview\n\n${body}` : body) : ''
}

// Wrap content in an expanded-by-default `<details>` block (collapsible via the
// `<summary>` section title) so a reader can fold sections away but sees them all
// up front. The `<summary>` is styled like a section heading by the docs site CSS
// (`.docs-content details > summary` in DocsLayout.astro), not inline here. The
// blank lines around the body are required: by CommonMark (which Astro's remark
// follows) a blank line ends the raw-HTML block, so the enclosed headings/code
// render as markdown instead of literal HTML. Returns empty string when all parts
// are falsy, matching section().
export function collapsible(
  summary: string,
  ...parts: (string | false | 0 | undefined)[]
) {
  return detailsBlock(summary, true, ...parts)
}

// Collapsed (folded-by-default) sibling of collapsible, for content that should
// be present for completeness but stay out of the way — e.g. the full signatures
// of undocumented plumbing members, which a compact table links down into.
// Fragment navigation to a heading inside auto-expands the <details> in modern
// browsers, so the anchor links still land (same behavior the member index table
// relies on).
export function collapsibleClosed(
  summary: string,
  ...parts: (string | false | 0 | undefined)[]
) {
  return detailsBlock(summary, false, ...parts)
}

function detailsBlock(
  summary: string,
  open: boolean,
  ...parts: (string | false | 0 | undefined)[]
) {
  const body = section(...parts)
  return body
    ? `<details${open ? ' open' : ''}>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`
    : ''
}

// Renders authored #example blocks under a consistent heading. Empty when none
// were authored.
//
// heading controls the level: '## Example usage' for top-level config/model
// pages, '#### Example usage' for API exports, '**Example:**' for slot/member
// level. Sub-example labels nest one level deeper (### for ##, ##### for ####,
// _italic_ for non-heading markers).
//
// note, if provided, is rendered in italics after all example content — useful
// for a "see Slots below" hint on config pages.
export function exampleSection(
  examples: Example[],
  heading = '## Example usage',
  note = '',
) {
  if (!examples.length) {
    return ''
  }
  const levelMatch = /^(#+)/.exec(heading)
  const subPrefix = levelMatch
    ? '#'.repeat(levelMatch[1].length + 1)
    : undefined
  const labelHeading = (label: string) =>
    label ? (subPrefix ? `${subPrefix} Example: ${label}` : `_${label}_`) : ''
  const bodies = examples.map(ex => section(labelHeading(ex.label), ex.content))
  return section(heading, ...bodies, note ? `_${note}_` : '')
}

// Composition is now derived from each model's factory (see
// resolveComposedModels), so any hand-authored `extends`/`composed of` marker
// block left in a #stateModel comment is redundant. Strip it from the rendered
// prose so it does not duplicate the generated "Inherited members" section.
//
// Removes the marker line and the bullet list that follows it — bullets, their
// indented continuation lines, and interleaved blanks — but stops at the next
// column-0 prose line, so description text authored after the block (e.g. a
// "note: ..." paragraph on the root models) is preserved.
export function stripComposedBlock(docs: string) {
  const lines = docs.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (/^[^\S\n]*(?:extends|composed of)\b/.test(lines[i]!)) {
      i++
      while (
        i < lines.length &&
        (/^\s*$/.test(lines[i]!) ||
          /^\s*-\s/.test(lines[i]!) ||
          /^\s+\S/.test(lines[i]!))
      ) {
        i++
      }
    } else {
      out.push(lines[i]!)
      i++
    }
  }
  return out.join('\n').trim()
}

// Parse every `#<tag> <a> | <b> | <rest...>` occurrence in a comment into
// [a, b, rest] tuples, in source order. `a` and `b` are the tag's two required
// leading fields (e.g. a color's group+label, a jexl function's category+
// example); `rest` re-joins any trailing pipe-separated text so a description or
// result may itself contain a `|`. A tag missing either leading field throws,
// naming `where`. Shared by the `#color` and `#jexlFunction` generators.
export function parsePipeTags(
  comment: string | undefined,
  tag: string,
  where: string,
): [string, string, string][] {
  const re = new RegExp(`#${tag}\\s+([^\\n]*)`, 'g')
  const out: [string, string, string][] = []
  for (const m of (comment ?? '').matchAll(re)) {
    const parts = m[1].split('|').map(s => s.trim())
    const [a, b] = parts
    if (!a || !b) {
      throw new Error(`${where}: malformed #${tag} tag "${m[0].trim()}"`)
    }
    out.push([a, b, parts.slice(2).join(' | ')])
  }
  return out
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'esm', 'cjs', 'build'])

// Recursively list every non-test .ts/.tsx source under a directory, skipping
// build output. Used by the regex-scanning generators (extension points,
// display foundations) that read tags straight from source text rather than
// through the TypeScript program.
export function listSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name)
    return e.isDirectory()
      ? SKIP_DIRS.has(e.name)
        ? []
        : listSources(full)
      : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
        ? [full]
        : []
  })
}

// Recursively list every .md doc under a directory. Shared by the marker-block
// generators (color/jexl/extension-point) that rewrite tagged regions embedded
// in the hand-written guides.
// CLAUDE.md files are agent instructions, not published pages, and they
// *describe* the marker syntax the generators look for (`<!-- GOTCHA
// <ConfigName> START -->`). Scanning them makes a generator parse its own
// documentation as real input, which is how `pnpm gendocs` came to die on the
// placeholder name `<ConfigName>`.
export function listDocs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name)
    return e.isDirectory()
      ? listDocs(full)
      : e.name.endsWith('.md') && e.name !== 'CLAUDE.md'
        ? [full]
        : []
  })
}

// Collapse the whitespace prettier adds when it pads markdown table columns, so
// a freshness (--check) comparison sees the block's *content* and not its
// formatting (committed tables are prettier-padded; the generators emit them
// compact). Regions outside the markers are byte-identical between current and
// regenerated, so normalizing them is a no-op for the comparison.
export function normalizeMarkerWhitespace(s: string) {
  return s.replaceAll(/[ \t]+/g, ' ').replaceAll(/-+/g, '-')
}

// Rewrite the region between a single `<!-- MARKER START -->`/`<!-- MARKER END -->`
// pair in every doc that contains it, returning the docs whose block content
// changed (used by --check to flag stale generated blocks without rewriting). A
// function replacer keeps any `$`-sequence in the rendered block literal. Shared
// by the single-marker generators (jexl catalog, extension-point index); the
// color tables use a per-group variant of the same idea.
export function rewriteMarkerBlock(
  marker: string,
  block: string,
  { check = false } = {},
): string[] {
  const startMarker = `<!-- ${marker} START -->`
  const endMarker = `<!-- ${marker} END -->`
  const re = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`)
  const full = `${startMarker}\n\n${block}\n\n${endMarker}`
  const stale: string[] = []
  for (const file of listDocs('website/docs')) {
    const original = fs.readFileSync(file, 'utf8')
    if (original.includes(startMarker)) {
      const updated = original.replace(re, () => full)
      if (check) {
        if (
          normalizeMarkerWhitespace(updated) !==
          normalizeMarkerWhitespace(original)
        ) {
          stale.push(file)
        }
      } else if (updated !== original) {
        fs.writeFileSync(file, updated)
      }
    }
  }
  return stale
}

// The grouped sibling of rewriteMarkerBlock, for markers that name which group
// they render (`<!-- COLOR_TABLE alignments-indicators START -->`) so one
// generator can feed many blocks across many docs. `render` returns a group's
// block body, and throws when the group is unknown — the message belongs to the
// caller, since an unrecognized group is always an authoring typo.
//
// Returns the docs whose block content changed (used by --check to flag stale
// blocks without rewriting) and the groups some doc actually rendered, so a
// caller can catch a tagged group that no page pulls in.
export function rewriteGroupedMarkerBlocks(
  marker: string,
  render: (group: string, file: string) => string,
  { check = false } = {},
) {
  const markerRe = new RegExp(`<!-- ${marker} (\\S+) START -->`, 'g')
  const stale: string[] = []
  const seen = new Set<string>()
  for (const file of listDocs('website/docs')) {
    const original = fs.readFileSync(file, 'utf8')
    let updated = original
    for (const [, group] of original.matchAll(markerRe)) {
      seen.add(group!)
      const startMarker = `<!-- ${marker} ${group} START -->`
      const endMarker = `<!-- ${marker} ${group} END -->`
      const re = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`)
      const full = `${startMarker}\n\n${render(group!, file)}\n\n${endMarker}`
      updated = updated.replace(re, () => full)
    }
    if (check) {
      if (
        normalizeMarkerWhitespace(updated) !==
        normalizeMarkerWhitespace(original)
      ) {
        stale.push(file)
      }
    } else if (updated !== original) {
      fs.writeFileSync(file, updated)
    }
  }
  return { stale, seen }
}

// CLI entry shared by the marker-block generators (color/jexl/extension-point).
// Runs the writer; in --check mode a stale-docs list exits non-zero so CI fails.
// Each caller still guards on argv[1] so importing from generate.ts stays inert.
export function runMarkerScript(
  label: string,
  write: (opts: { check: boolean }) => string[],
) {
  const stale = write({ check: process.argv.includes('--check') })
  if (stale.length) {
    console.error(
      `${label} out of date — run \`pnpm autogen\`:\n${stale.map(f => `  ${f}`).join('\n')}`,
    )
    process.exit(1)
  }
  console.log(`${label} up to date`)
}

export async function getAllFiles() {
  const { stdout } = await exec2(
    String.raw`git ls-files | grep "\(plugins\|products\|packages\).*\.\(t\|j\)sx\?$"`,
  )
  return stdout.split('\n').filter(Boolean)
}
