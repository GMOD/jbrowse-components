import * as ts from 'typescript'

import {
  MODEL_CHAIN_METHODS,
  headIdentifier,
  isTypesCall,
  returnedExpression,
} from './astShapes.ts'
import { MEMBER_TAGS, getOwnJSDocText, startsWithTag } from './jsDocTags.ts'
import { describeSymbol, followAlias, nodeBase } from './symbols.ts'
import { writtenFunction } from './typeSignatures.ts'
import { repoRelative } from './util.ts'

import type { ExtractedNode, NodeBase } from './docProgram.ts'
import type { MemberTag } from './jsDocTags.ts'
import type { Described } from './symbols.ts'
import type { PrintedType } from './typeSignatures.ts'

// A member node: what every node carries, and what MST fills a property with
export function memberNode(
  type: MemberTag,
  base: NodeBase,
  { propertyDefault }: Described,
): ExtractedNode {
  return { ...base, type, propertyDefault }
}

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

// A member that sits in an MST block but the structural pass can't document and
// no tag rescued: an untagged `{ foo }` shorthand returning a local function in
// .views()/.actions(). Surfaced as a warning so the gap is visible, not silent.
export interface BlindSpot {
  filename: string
  kind: MemberBlock
  name: string
}

// Emit an ExtractedNode for an untagged MST member, classified by which block of
// the factory chain encloses it. Tagged members never reach here, so this only
// fills the documentation gaps that hand-written tags missed. Members in a block
// that resist structural classification are recorded as blind spots instead.
export function emitUntaggedMember(
  checker: ts.TypeChecker,
  named: PrintedType[],
  node: ts.Node,
  comment: string,
  cb: (obj: ExtractedNode) => void,
  blindSpots: BlindSpot[],
) {
  const block = enclosingMemberBlock(node)
  if (
    !block ||
    !modelDeclarations(node.getSourceFile()).some(d => encloses(d, node))
  ) {
    return
  }
  const type = memberType(node, block)
  if (type) {
    const described = describeSymbol(checker, named, node, type === 'property')
    if (
      described.name &&
      !(block === 'actions' && LIFECYCLE_HOOKS.has(described.name))
    ) {
      const base = nodeBase(
        described,
        comment,
        node.getFullText(),
        node.getSourceFile().fileName,
      )
      cb(memberNode(type, base, described))
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

function encloses(outer: ts.Node, inner: ts.Node) {
  return outer.pos <= inner.pos && inner.end <= outer.end
}

// The declarations whose MST blocks are the documented model: the one the
// `#stateModel` JSDoc sits on, and every same-file declaration it reaches as a
// `types.compose` argument or as the base a `.props/.views/...` chain extends.
// A `types.model` reached only as a property's type — `types.array(LayoutTab)`
// — is a different node's model, and its members are not this one's.
const modelDeclarationCache = new WeakMap<ts.SourceFile, ts.Node[]>()

function modelDeclarations(sourceFile: ts.SourceFile) {
  let found = modelDeclarationCache.get(sourceFile)
  if (!found) {
    const topLevel = new Map<string, ts.Node>()
    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        topLevel.set(statement.name.text, statement)
      } else if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            topLevel.set(decl.name.text, decl)
          }
        }
      }
    }
    const owned: ts.Node[] = []
    const own = (node: ts.Node | undefined) => {
      if (node && !owned.includes(node)) {
        owned.push(node)
        ts.forEachChild(node, reach)
      }
    }
    const ownNamed = (expr: ts.Expression) => {
      const head = headIdentifier(
        expr,
        name => MODEL_CHAIN_METHODS.has(name) || name === 'named',
      )
      if (head) {
        own(topLevel.get(head.text))
      }
    }
    const reach = (node: ts.Node) => {
      if (isTypesCall(node, 'compose')) {
        node.arguments.forEach(ownNamed)
      } else if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        MODEL_CHAIN_METHODS.has(node.expression.name.text)
      ) {
        ownNamed(node.expression.expression)
      }
      ts.forEachChild(node, reach)
    }
    const visitHeader = (node: ts.Node) => {
      if (startsWithTag(getOwnJSDocText(node), 'stateModel')) {
        own(node)
      } else {
        ts.forEachChild(node, visitHeader)
      }
    }
    ts.forEachChild(sourceFile, visitHeader)
    found = owned
    modelDeclarationCache.set(sourceFile, found)
  }
  return found
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
  return !MEMBER_TAGS.some(t => startsWithTag(doc, t))
}

type MemberBlock = 'property' | 'volatile' | 'views' | 'actions'

// The MST member block a call introduces, or undefined. `types.model({...})`
// carries the persisted properties; `.volatile()`, `.views()`, and `.actions()`
// each contribute their named kind. Detected structurally so members need no
// per-member JSDoc tag to be documented.
function memberBlockKind(node: ts.Node): MemberBlock | undefined {
  const name =
    ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : undefined
  return isTypesCall(node, 'model')
    ? 'property'
    : name === 'volatile' || name === 'views' || name === 'actions'
      ? name
      : undefined
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

// A member block whose argument names a declaration elsewhere instead of
// writing the object inline — `.views(configSlotViews)`, or the
// `.volatile(() => CONSTANTS)` shape that returns a shared object. The
// generator buckets members by the FILE they are written in, so without this
// every row in such a block lands in a bucket with no #stateModel header and
// `withHeaders` drops it: the page loses the members and nothing says so.
//
// This is what makes a model file splittable at all. Extracting a getter's
// BODY to a sibling module has always been free (the thin getter stays behind,
// carrying the docstring), but extracting the getters themselves was not, and
// that is the difference between moving a few hundred lines and moving the
// ~1,500 lines of config-slot plumbing the display models are mostly made of.
// `types.compose` was the one extraction the generator already followed, which
// is why a shared concern could become a mixin and a per-model one could not.
interface DelegatedBlock {
  kind: MemberBlock
  obj: ts.ObjectLiteralExpression
}

// The member-block call `node` is the members argument of, if any. `types.model`
// is excluded: its argument is a plain object literal, never a callback, so
// there is no indirection to follow.
function delegatingCallKind(node: ts.Node): MemberBlock | undefined {
  const call = node.parent
  if (!ts.isCallExpression(call) || call.arguments.at(-1) !== node) {
    return undefined
  }
  const kind = memberBlockKind(call)
  return kind && kind !== 'property' ? kind : undefined
}

// Resolve a member-block argument that names its object rather than writing it,
// following one level of indirection. Returns undefined when the argument is an
// ordinary inline callback (already handled by `memberObjectLiteral`) or when
// nothing can be resolved — `unresolvedDelegation` decides which of those it is.
export function delegatedBlockAt(
  checker: ts.TypeChecker,
  node: ts.Node,
): DelegatedBlock | undefined {
  const kind = delegatingCallKind(node)
  if (!kind || !ts.isExpression(node)) {
    return undefined
  }
  const obj = delegatedMembersObject(checker, node)
  return obj ? { kind, obj } : undefined
}

// The members object an argument ultimately yields. Four shapes, all of which
// `memberObjectLiteral` gives up on: a bare identifier naming the callback
// (`.views(sharedViews)`), a callback that returns an identifier naming a shared
// object (`.volatile(() => CONSTANTS)`), a factory call returning the callback
// (`.views(makeViews(schema))`) — the shape a block that needs an argument
// beyond `self` takes, and the one this would otherwise make fatal while
// encouraging people to extract blocks in the first place — and a callback that
// CALLS the shared one (`.views(self => sharedViews(self))`,
// `.volatile(() => createVolatileState())`), which an author writes when the
// shared block declares its own host type or takes no `self` at all.
//
// That last shape resolved to nothing, and an ArrowFunction is not what
// `unresolvedDelegation` fires on, so it lost members with nothing said — the one
// outcome the fatal check exists to prevent. It cost four of wiggle's getters and
// methods, which at least showed up in the orphan-members coverage gap, and every
// volatile the add-track form has, which showed up in no gap at all: they carry no
// member tag, so the page simply had no Volatiles section.
function delegatedMembersObject(
  checker: ts.TypeChecker,
  arg: ts.Expression,
): ts.ObjectLiteralExpression | undefined {
  if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
    return objectLiteralBehind(checker, arg.expression)
  }
  if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
    const ret = returnedExpression(arg)
    return ret && (ts.isIdentifier(ret) || ts.isCallExpression(ret))
      ? delegatedMembersObject(checker, ret)
      : undefined
  }
  return ts.isIdentifier(arg) ? objectLiteralBehind(checker, arg) : undefined
}

// The object literal an identifier stands for: the object a named callback
// returns (`const sharedViews = self => ({...})`, or a function declaration), or
// a named object constant. Alias-followed, so an import resolves to the
// declaration in the file that owns it.
function objectLiteralBehind(checker: ts.TypeChecker, id: ts.Identifier) {
  const symbol = checker.getSymbolAtLocation(id)
  const decl = symbol && followAlias(checker, symbol).declarations?.[0]
  if (!decl) {
    return undefined
  }
  const fn = writtenFunction(decl)
  if (fn) {
    // One extra hop for a factory: `makeViews = schema => self => ({...})`
    // returns the callback rather than the members, so the object is a level
    // further in than for a callback named directly.
    const direct = returnedObjectLiteral(fn)
    if (direct) {
      return direct
    }
    const inner = returnedExpression(fn)
    return inner &&
      (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner))
      ? returnedObjectLiteral(inner)
      : undefined
  }
  return ts.isVariableDeclaration(decl) &&
    decl.initializer &&
    ts.isObjectLiteralExpression(decl.initializer)
    ? decl.initializer
    : undefined
}

// A member-block argument that names something the generator could not reduce
// to an object literal. Every row the block declares would silently vanish, so
// this is fatal rather than a coverage-gap line — the same reasoning as
// `assertNoUntaggedSlots`: the count is zero, and the fix is local. An inline
// callback the structural pass merely finds nothing in is NOT this; it keeps
// its existing non-fatal treatment, because there is nothing to point the
// author at.
function unresolvedDelegation(checker: ts.TypeChecker, node: ts.Node) {
  const kind = delegatingCallKind(node)
  return kind &&
    (ts.isIdentifier(node) || ts.isCallExpression(node)) &&
    !delegatedMembersObject(checker, node)
    ? { filename: node.getSourceFile().fileName, kind, text: node.getText() }
    : undefined
}

interface UnresolvedBlock {
  filename: string
  kind: MemberBlock
  text: string
}

// Walk the #stateModel files once before anything is emitted, resolving every
// delegated member block. Cheap — the program has already parsed these trees,
// and it is a small fraction of the corpus — and it is what makes the two
// answers that depend on a delegation independent of file order.
export function collectDelegatedClaims(
  checker: ts.TypeChecker,
  sources: readonly ts.SourceFile[],
) {
  const claimed = new Set<string>()
  const unresolved: UnresolvedBlock[] = []
  for (const sourceFile of sources) {
    if (!startsWithTag(sourceFile.getFullText(), 'stateModel')) {
      continue
    }
    const walk = (node: ts.Node) => {
      const delegated = delegatedBlockAt(checker, node)
      if (delegated) {
        for (const prop of delegated.obj.properties) {
          claimed.add(memberKey(prop))
        }
      } else {
        const bad = unresolvedDelegation(checker, node)
        if (bad) {
          unresolved.push(bad)
        }
      }
      ts.forEachChild(node, walk)
    }
    ts.forEachChild(sourceFile, walk)
  }
  return { claimed, unresolved }
}

export function assertNoUnresolvedDelegations(blocks: UnresolvedBlock[]) {
  if (blocks.length) {
    throw new Error(
      `${blocks.length} MST member block(s) name a declaration this generator cannot resolve to an object literal, so every member they declare would be dropped from the model page with no warning. Point the call at a directly-named callback (\`.views(sharedViews)\` where \`sharedViews\` is a \`const\`/\`function\` in scope), or write the block inline:\n${blocks
        .map(b => `  ${repoRelative(b.filename)} .${b.kind}(${b.text})`)
        .join('\n')}`,
    )
  }
}

// Emit one delegated block's members as if they had been written inline in the
// model file. `filename` is the MODEL's, which is the whole mechanism: that is
// the key `accumulateModel` buckets by, and the bucket the #stateModel header
// sits on. Called at the point the walk reaches the argument, so the members
// land in chain position — a model page's tables are in source order, and a
// block hoisted to the front of one reads as a different model.
export function emitDelegatedMembers(
  checker: ts.TypeChecker,
  named: PrintedType[],
  { kind, obj }: DelegatedBlock,
  modelFile: string,
  cb: (obj: ExtractedNode) => void,
) {
  // A block delegated to from inside the model's own file is already bucketed
  // to the right page by whichever pass sees it — but only the TAG pass sees
  // it, since `enclosingMemberBlock` cannot climb from a standalone `const
  // localViews = () => ({...})` to a chain call. So a tagged member here would
  // be emitted twice and an untagged one not at all; take exactly the second.
  const sameFile = obj.getSourceFile().fileName === modelFile
  for (const prop of obj.properties) {
    const comment = getOwnJSDocText(prop)
    const tagged = comment
      ? MEMBER_TAGS.filter(t => startsWithTag(comment, t))
      : []
    if (sameFile && tagged.length) {
      continue
    }
    const structural = memberType(prop, kind)
    const types: MemberTag[] = tagged.length
      ? [...tagged]
      : structural
        ? [structural]
        : []
    const described = describeSymbol(
      checker,
      named,
      prop,
      types.includes('property'),
    )
    if (
      !types.length ||
      !described.name ||
      (kind === 'actions' && LIFECYCLE_HOOKS.has(described.name))
    ) {
      continue
    }
    const base = nodeBase(described, comment, prop.getFullText(), modelFile)
    for (const type of types) {
      cb(memberNode(type, base, described))
    }
  }
}

// Identity of one member node, independent of which model claimed it — a shared
// block reached by two models is claimed by both and emitted onto both pages.
export function memberKey(node: ts.Node) {
  return `${node.getSourceFile().fileName}:${node.pos}`
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
function memberType(node: ts.Node, kind: MemberBlock): MemberTag | undefined {
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
