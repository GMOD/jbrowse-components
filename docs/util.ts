import { exec } from 'child_process'
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

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
      // Structural member detection only runs in files that document a
      // #stateModel, so non-model helper files with their own .views()/
      // .actions() chains don't contribute spurious members.
      const isStateModel = hasTag(sourceFile.getFullText(), 'stateModel')
      const isTestFile = /\.test\.tsx?$/.test(sourceFile.fileName)
      ts.forEachChild(sourceFile, node => visit(node, isStateModel, isTestFile))
    }
  }
  reportBlindSpots(blindSpots)

  function visit(node: ts.Node, isStateModel: boolean, isTestFile: boolean) {
    // Unlike the JSDoc-tag pass below, this structural check isn't gated by a
    // tag a test fixture would never carry — a unit test that constructs its
    // own `new DisplayType(...)` fixture would otherwise show up as a real
    // track/display link, so test files are excluded outright.
    const link = isTestFile ? undefined : displayTrackLink(node)
    if (link) {
      onDisplayLink(link)
    }
    const comment = getOwnJSDocText(node)
    const tags = comment ? TAG_TYPES.filter(t => hasTag(comment, t)) : []
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
    ts.forEachChild(node, n => visit(n, isStateModel, isTestFile))
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
  return !MEMBER_TAGS.some(t => hasTag(doc, t))
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
    signature:
      symbol && decl
        ? checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, decl))
        : '',
    declId: symbolDeclId(checker, symbol),
  }
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
// scan (hasTag) and the per-line parse in parseTaggedComment.
function containsTag(text: string, name: string) {
  return new RegExp(`#${name}(?![A-Za-z0-9_])`).test(text)
}

function hasTag(comment: string, tag: TagType) {
  return containsTag(comment, tag)
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
        : (jd.comment?.map(p => p.text).join('') ?? ''),
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
// (#example minimal, #example full). Returns { name, docs, examples }.
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
  const docs: string[] = []
  const examples: Example[] = []
  let current: { label: string; lines: string[] } | undefined
  for (const line of lines) {
    if (containsTag(line, 'example')) {
      if (current) {
        examples.push({
          label: current.label,
          content: current.lines.join('\n').trim(),
        })
      }
      current = { label: line.replace(/.*#example\s*/, '').trim(), lines: [] }
    } else if (containsTag(line, type)) {
      const fromTag = line.replace(tag, '').trim()
      if (fromTag) {
        name = fromTag
      }
    } else if (containsTag(line, 'category')) {
      category = line.replace(/.*#category\s*/, '').trim() || undefined
    } else if (current) {
      current.lines.push(line)
    } else {
      docs.push(line)
    }
  }
  if (current) {
    examples.push({
      label: current.label,
      content: current.lines.join('\n').trim(),
    })
  }
  return {
    name,
    category,
    docs: docs.join('\n'),
    examples,
  }
}

export interface ParsedNode {
  name: string
  docs: string
  examples: Example[]
  category?: string
  code: string
  signature: string
}

// Parse one extracted node into the fields the config and state-model generators
// both build their Item/Member records from: the tag-parsed name/docs/examples/
// category, plus the comment-stripped source and type signature. Shared so the
// two near-identical buildItem/buildMember helpers don't drift.
export function parseNode(obj: ExtractedNode): ParsedNode {
  const { name, docs, examples, category } = parseTaggedComment(
    obj.comment,
    obj.type,
    obj.name,
  )
  return {
    name,
    docs,
    examples,
    category,
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

// Shared markdown builders used by both generators.
export function codeBlock(...lines: string[]) {
  return ['```js', ...lines, '```'].join('\n')
}

// The shared skeleton every generated config/model page wears: Docusaurus
// frontmatter, a "this is auto-generated" preamble, a Links section pointing at
// the source and the GitHub-hosted doc, then the page body. The config and
// model generators differ only in `notes`, `sourcePath`, and `githubDocPath`, so
// the skeleton lives here to stay single-sourced.
export function docPage({
  id,
  title,
  sidebarLabel,
  notes,
  sourcePath,
  githubDocPath,
  body,
}: {
  id: string
  title: string
  sidebarLabel: string
  notes: string
  sourcePath: string
  githubDocPath: string
  body: string
}) {
  return `---
id: ${id}
title: ${title}
sidebar_label: ${sidebarLabel}
---

${notes}

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/${sourcePath})

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/${githubDocPath})

${body}
`
}

// Warn when a second, differently-named #config/#stateModel tag turns up in a
// file that already documents one (only the last is rendered — one per file).
// A #config/#stateModel const is tagged twice (the VariableStatement and its
// inner declaration); the statement half resolves to an empty name when the tag
// carries none, so an empty `incoming` never trips this — only two non-empty,
// differing names do. Shared by both accumulators.
export function warnDuplicateHeader({
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
    console.warn(
      `${filename}: multiple #${tag} tags ("${existing}" then "${incoming}"); only the last is documented (one #${tag} per file)`,
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
// parts are falsy, so no stray heading appears on sparse pages.
export function overviewSection(...parts: (string | false | 0 | undefined)[]) {
  const body = section(...parts)
  return body ? `## Overview\n\n${body}` : ''
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
  const body = section(...parts)
  return body
    ? `<details open>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`
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

export async function getAllFiles() {
  const { stdout } = await exec2(
    String.raw`git ls-files | grep "\(plugins\|products\|packages\).*\.\(t\|j\)sx\?$"`,
  )
  return stdout.split('\n').filter(Boolean)
}
