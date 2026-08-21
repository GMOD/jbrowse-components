import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

import * as ts from 'typescript'

import { BUILD_DIRS, isDocFile, isTsSource, walkFiles } from '../check-utils.ts'
import { readDoc, writeDoc } from './format.ts'

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
  // For `#stateModel` nodes only: whether the annotated declaration actually
  // contains a `types.model` / `types.compose` call. False means the tag is
  // attached to something else — the failure this catches is a declaration
  // sliding in between the JSDoc and its factory, which still renders a page
  // (the header parses from the comment) while `composedOf` resolves empty, so
  // every inherited member silently vanishes from the table. See the
  // misattached-#stateModel gap section in generate.ts.
  definesModel?: boolean
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
  /**
   * The view type the display renders in — the other half of what a
   * registration declares, and the axis `config_guides/tracks.md` does not
   * show. Absent only if a registration omits it, which nothing in tree does.
   */
  viewType?: string
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

// The whole-repo TypeScript program plus the subset of its source files that
// belong to this repo — the program also parses node_modules and lib `.d.ts` to
// resolve types, which document nothing.
//
// Building the program is the dominant cost of a run (~10s), so it is built once
// here and every pass that needs an AST reads `sources` rather than reparsing.
// The enum-constant index used to `createSourceFile` all ~4000 files itself,
// paying a second full parse (~4s) for trees the program already had.
export interface DocProgram {
  program: ts.Program
  sources: ts.SourceFile[]
}

export function createDocProgram(
  fileNames: string[],
  options: ts.CompilerOptions = {},
): DocProgram {
  const program = ts.createProgram(fileNames, options)
  // `sf.fileName` is whatever form the file entered the program as: a root file
  // keeps the relative path it was passed, an import-resolved one is absolute.
  // Both are resolved before comparing — matching raw strings silently dropped
  // the 2143 root files TypeScript never had to resolve through an import.
  const roots = new Set(fileNames.map(f => path.resolve(f)))
  return {
    program,
    sources: program
      .getSourceFiles()
      .filter(
        sf => !sf.isDeclarationFile && roots.has(path.resolve(sf.fileName)),
      ),
  }
}

export function extractWithComment(
  { program, sources }: DocProgram,
  cb: (obj: ExtractedNode) => void,
  onDisplayLink: (link: DisplayTrackLink) => void,
) {
  const checker = program.getTypeChecker()
  const blindSpots: BlindSpot[] = []
  const slotGaps: ConfigSlotGap[] = []
  const behindATag: DocsBehindTagGap[] = []
  // Which members a model reaches through a delegated block, and the blocks
  // that name something unresolvable. Collected up front because a helper file
  // can be walked before or after the model that delegates to it, and both
  // answers below have to be the same either way: whether the helper's own tag
  // pass should stay quiet (the model is emitting these rows), and whether a
  // tagged member is orphaned (no model renders it anywhere).
  const { claimed, unresolved } = collectDelegatedClaims(checker, sources)
  assertNoUnresolvedDelegations(unresolved)
  // Member-tagged nodes in files that document no #stateModel and that no model
  // claimed. Each renders on no page — see `orphanMembers`.
  const memberTagged = new Map<string, string>()

  for (const sourceFile of sources) {
    // Test files are excluded outright: their fixtures (a `#config` fixture
    // comment, a hand-built `new DisplayType(...)`) would otherwise be mistaken
    // for real documented entities or track/display links.
    if (!/\.test\.tsx?$/.test(sourceFile.fileName)) {
      // Structural member detection only runs in files that document a
      // #stateModel, and the untagged-slot audit only in files that document a
      // #config, so helper files with their own .actions() chains or internal
      // ConfigurationSchema calls don't contribute spurious members/gaps.
      const text = sourceFile.getFullText()
      const isStateModel = containsTag(text, 'stateModel')
      const isConfig = containsTag(text, 'config')
      ts.forEachChild(sourceFile, node => {
        visit(node, isStateModel, isConfig)
      })
    }
  }
  assertNoUntaggedSlots(slotGaps)
  assertNoDocsBehindATag(behindATag)
  return {
    // `<file> <name>` per gap, for the committed coverage list
    blindSpots: blindSpots.map(s => `${repoRelative(s.filename)} ${s.name}`),
    // Member tags in a file that documents no #stateModel and that no model
    // claimed through a delegated block. Each is a documented member that
    // renders on no page: `withHeaders` drops a bucket with no header, and it
    // drops it in silence. Reported rather than fatal because the count is not
    // zero — an `extendViewType` augmentation tags members onto a model owned by
    // another plugin, which is a real shape this generator has no page for.
    // Deduped by label: a member declared as an exported `const` is visited
    // twice, as the statement and as the declaration, and the two nodes carry
    // different positions but name one member.
    orphanMembers: [
      ...new Set(
        [...memberTagged]
          .filter(([key]) => !claimed.has(key))
          .map(([, label]) => label),
      ),
    ],
  }

  function visit(node: ts.Node, isStateModel: boolean, isConfig: boolean) {
    const link = displayTrackLink(node)
    if (link) {
      onDisplayLink(link)
    }
    if (isConfig) {
      collectUntaggedSlots(node, slotGaps)
    }
    if (isStateModel) {
      const delegated = delegatedBlockAt(checker, node)
      if (delegated) {
        emitDelegatedMembers(
          checker,
          delegated,
          node.getSourceFile().fileName,
          cb,
        )
      }
    }
    const comment = getOwnJSDocText(node)
    const tags = comment ? TAG_TYPES.filter(t => containsTag(comment, t)) : []
    // A member in a helper file some model delegates to is that model's row,
    // already emitted against the model's filename. Emitting it here too would
    // bucket a second copy under this file, where no #stateModel header can
    // render it — dropped in silence, and counted as an orphan.
    //
    // Suppressed only when EVERY tag on the node is a member tag. A node also
    // carrying a page-level tag (#api, #slot) has a second home the delegation
    // says nothing about, and dropping the whole node would take that with it.
    const delegatedAway =
      !isStateModel &&
      tags.length > 0 &&
      tags.every(isMemberTag) &&
      claimed.has(memberKey(node))
    if (tags.length && !delegatedAway) {
      if (!isStateModel && tags.some(isMemberTag)) {
        memberTagged.set(
          memberKey(node),
          `${repoRelative(node.getSourceFile().fileName)} ${describeSymbol(checker, node).name}`,
        )
      }
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
        definesModel: tags.includes('stateModel')
          ? definesStateModel(node)
          : undefined,
      }
      collectDocsBehindATag(node, comment, name, behindATag)
      for (const type of tags) {
        cb({ type, ...base })
      }
    } else if (isStateModel) {
      // Untagged members are recovered structurally from their position in the
      // MST factory chain. A node either has a tag (handled above, unchanged) or
      // is examined here, so no member is ever emitted twice.
      emitUntaggedMember(checker, node, comment, cb, blindSpots)
    }
    ts.forEachChild(node, n => {
      visit(n, isStateModel, isConfig)
    })
  }
}

// A documented member whose only prose sits after a JSDoc `@tag`, where the
// generator cannot see it.
interface DocsBehindTagGap {
  filename: string
  name: string
}

// Whether a docs-tagged block carries prose of its own: any line that is neither
// blank nor one of the `#tag` lines the generator reads as structure.
function hasOwnProse(comment: string) {
  return comment
    .split('\n')
    .some(line => line.trim() && !/^#\w+/.test(line.trim()))
}

function collectDocsBehindATag(
  node: ts.Node,
  comment: string,
  name: string,
  gaps: DocsBehindTagGap[],
) {
  if (!hasOwnProse(comment) && getOwnJSDocTagText(node).trim()) {
    gaps.push({ filename: node.getSourceFile().fileName, name })
  }
}

// Fatal, on the argument assertNoBlankSlotDescriptions makes: the count is zero
// and the fix is moving one sentence within the docstring the error names.
//
// A member with no prose at all renders a blank cell too, and 2,887 of those
// exist — a backlog, not a bug. This one is narrower and worse: the author DID
// write the sentence, and the page shows nothing. Three members reached the site
// that way (both mixins' `addTrackConf` and `getTracksById`), each of them the
// row telling a plugin author that a deprecated name still resolves and what to
// call instead.
function assertNoDocsBehindATag(gaps: DocsBehindTagGap[]) {
  if (gaps.length) {
    throw new Error(
      `${gaps.length} documented member(s) put every word of their prose after a JSDoc @tag, so TypeScript files it under \`tags\` and the generator publishes a blank Description cell. Lead with the prose and leave the bare tag under it (\`@deprecated\` on its own line):\n${gaps
        .map(g => `  ${repoRelative(g.filename)} ${g.name}`)
        .join('\n')}`,
    )
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

// Fatal, not a warning. A slot a `#config` schema declares but never tags is
// absent from the generated page entirely — the failure mode that hid
// `configuration.shareURL` when its comment used `/*` instead of `/**`. The
// count is zero, and the fix is unambiguous and local, so the only way it stays
// zero is if adding one stops the build rather than printing a line nobody
// reads. Everything with a real backlog goes in the committed coverage list
// instead; this is the one that can be held at zero.
function assertNoUntaggedSlots(gaps: ConfigSlotGap[]) {
  if (gaps.length) {
    const byFile = new Map<string, ConfigSlotGap[]>()
    for (const gap of gaps) {
      const file = repoRelative(gap.filename)
      byFile.set(file, [...(byFile.get(file) ?? []), gap])
    }
    throw new Error(
      `${gaps.length} config slot(s) in a #config schema have no #slot tag, so they are silently missing from the generated docs. Add a /** #slot */ comment (a single-star /* comment is ignored):\n${[
        ...byFile,
      ]
        .map(
          ([file, list]) =>
            `  ${file}: ${list.map(g => `${g.schema}.${g.slot}`).join(', ')}`,
        )
        .join('\n')}`,
    )
  }
}

/**
 * Every registered display type must have a `#config` block of its own name.
 *
 * Fatal, like `assertNoUntaggedSlots` above and for the same reason: the count
 * is zero, and the fix is local and unambiguous. What it prevents is entirely
 * silent — a display whose schema is built by a `makeConfigSchema(typeName)`
 * helper has no `#config` block anywhere, because the generator keys a block to
 * its FILE and cannot see a name that only exists as a parameter at runtime. So
 * the display gets no config page, renders as bare unlinked text in the
 * track-type table, is absent from the "settings with a session-wide default"
 * table however many promotable slots it has, and — worst — the shared base it
 * derives from is left as the only documented name, so ITS slot table tells
 * readers to write `type: '<Base>Display'`, which nothing accepts.
 *
 * That has happened twice: the two GC-content displays, then the two LD ones.
 * Both times it was found by a person reading a docs page, not by a check. The
 * fix both times was one annotated file per registered type.
 *
 * `sources` excludes test files (see `extractWithComment`), so the fixtures that
 * hand-build a `new DisplayType(...)` never reach `displayToTrackType` and this
 * needs no exclusion list of its own.
 */
export function assertEveryDisplayTypeIsDocumented(
  displayToTrackType: Map<string, string>,
  configNames: Set<string>,
) {
  const missing = [...displayToTrackType.keys()]
    .filter(name => !configNames.has(name))
    .sort((a, b) => a.localeCompare(b))
  if (missing.length) {
    throw new Error(
      `${missing.length} registered display type(s) have no #config block of their own name, so they get no config page and drop out of every generated table. Give each one an annotated schema file — a schema built from a \`makeConfigSchema(typeName)\` helper cannot be seen, since a #config block is keyed to its file:\n${missing
        .map(name => `  ${name}`)
        .join('\n')}`,
    )
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

const MEMBER_TAGS = [
  'property',
  'volatile',
  'getter',
  'method',
  'action',
] as const

// A tag that documents a member of a model, as opposed to one that documents an
// entity with a page of its own (#stateModel, #config, #api, #slot).
function isMemberTag(tag: TagType): tag is (typeof MEMBER_TAGS)[number] {
  return (MEMBER_TAGS as readonly string[]).includes(tag)
}

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
function delegatedBlockAt(
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

// The members object an argument ultimately yields. Three shapes, all of which
// `memberObjectLiteral` gives up on: a bare identifier naming the callback
// (`.views(sharedViews)`), a callback that returns an identifier naming a shared
// object (`.volatile(() => CONSTANTS)`), and a factory call returning the
// callback (`.views(makeViews(schema))`) — the shape a block that needs an
// argument beyond `self` takes, and the one this would otherwise make fatal
// while encouraging people to extract blocks in the first place.
function delegatedMembersObject(
  checker: ts.TypeChecker,
  arg: ts.Expression,
): ts.ObjectLiteralExpression | undefined {
  if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
    return objectLiteralBehind(checker, arg.expression)
  }
  if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
    const ret = returnedExpression(arg)
    return ret && ts.isIdentifier(ret)
      ? objectLiteralBehind(checker, ret)
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
  const fn = factoryFunction(decl)
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
    !delegatedMembersObject(checker, node as ts.Expression)
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
function collectDelegatedClaims(
  checker: ts.TypeChecker,
  sources: readonly ts.SourceFile[],
) {
  const claimed = new Set<string>()
  const unresolved: UnresolvedBlock[] = []
  for (const sourceFile of sources) {
    if (
      /\.test\.tsx?$/.test(sourceFile.fileName) ||
      !containsTag(sourceFile.getFullText(), 'stateModel')
    ) {
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

function assertNoUnresolvedDelegations(blocks: UnresolvedBlock[]) {
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
function emitDelegatedMembers(
  checker: ts.TypeChecker,
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
      ? MEMBER_TAGS.filter(t => containsTag(comment, t))
      : []
    if (sameFile && tagged.length) {
      continue
    }
    const structural = memberType(prop, kind)
    const types: TagType[] = tagged.length
      ? [...tagged]
      : structural
        ? [structural]
        : []
    const { name, signature, declId } = describeSymbol(checker, prop)
    if (
      !types.length ||
      !name ||
      (kind === 'actions' && LIFECYCLE_HOOKS.has(name))
    ) {
      continue
    }
    for (const type of types) {
      cb({
        type,
        name,
        comment,
        signature,
        node: prop.getFullText(),
        filename: modelFile,
        selfDeclId: declId,
      })
    }
  }
}

// Identity of one member node, independent of which model claimed it — a shared
// block reached by two models is claimed by both and emitted onto both pages.
function memberKey(node: ts.Node) {
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
  const symbolName = symbol?.getName() ?? ''
  return {
    // `export default function Foo()` gives the symbol the name "default",
    // which is what the module exports it as and not what anyone calls it. The
    // declaration still carries `Foo`, so prefer that. Two such exports in one
    // package otherwise render as two `## default` sections on one page —
    // duplicate anchors, and nothing to tell them apart. (A default-exported
    // *const* already reads correctly; that aliasing is handled above.)
    name:
      symbolName === 'default' && nameNode && ts.isIdentifier(nameNode)
        ? nameNode.text
        : symbolName,
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
    sortUnionMembers(
      printed.endsWith('...')
        ? checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
        : printed,
    ),
  )
}

// The checker prints a union in its own order, not ours, and that order moves
// with the composition of the program — which `getAllFiles` builds from
// `git ls-files --cached --others`, untracked files included. `pnpm autogen
// --check` is a CI gate, so a doc nobody touched goes red for it; 161d06e858
// fixed the display-link half of this and measured the half left over, a union
// on `LinearGenomeView.setTrackLabels`. Sorting on the printed text makes the
// row a function of the sources.
//
// Only RUNS OF STRING LITERALS are sorted, wherever they appear. That is the
// churn that has been seen — a stringEnum's choices — and confining the rewrite
// to literals is what makes it safe to apply at any depth without tracking
// brackets: `setTrackLabels`'s union sits inside a parameter list, where the
// prefix `setting: ` binds to the first member and a naive split reorders it
// into nonsense.
//
// Sorting whole top-level unions instead was tried and reverted: it also turned
// `{ type?: string; … } | undefined` into `undefined | { type?: string; … }`,
// which is stable and worse — the elided preview a reader sees first became the
// word `undefined` rather than the shape.
//
// Applied BEFORE eliding, so which alternatives elision drops off the end is
// decided by the same stable order.
const STRING_LITERAL_UNION = /"(?:[^"\\]|\\.)*"(?:\s*\|\s*"(?:[^"\\]|\\.)*")+/g

export function sortUnionMembers(sig: string) {
  return sig.replaceAll(STRING_LITERAL_UNION, run =>
    run
      .split('|')
      .map(m => m.trim())
      .sort()
      .join(' | '),
  )
}

// Longer than this and a signature stops being read and starts being skipped.
const MAX_SIGNATURE = 180

// Collapse `<...>` / `{...}` groups from the inside out until the string fits,
// in one left-to-right pass. A stack of partial results reaches every group in
// post-order — innermost first, leftmost among those — which is exactly the
// order a repeated "find the innermost group, elide it, rescan" loop reaches
// them in, so the output is unchanged.
//
// The rescan is what made this worth rewriting. Each pass skipped over the run
// of already-elided groups to its left before finding the next one, so the cost
// was quadratic in the number of groups; MST's expanded model types print at up
// to 250KB, and shortening ~3600 of them was 22% of a `pnpm gendocs` run — more
// than building the whole TypeScript program.
//
// The `>` of a `=>` is not a bracket, and an `open` that never closes is not a
// group: its text goes back verbatim.
function elideGroups(sig: string, open: string, close: string, max: number) {
  let length = sig.length
  const enclosing: string[] = []
  let out = ''
  for (let i = 0; i < sig.length; i++) {
    const c = sig[i]!
    if (c === open) {
      enclosing.push(out)
      out = ''
    } else if (
      c === close &&
      enclosing.length &&
      !(close === '>' && sig[i - 1] === '=')
    ) {
      const inner = out
      out = enclosing.pop()!
      if (length > max) {
        length -= inner.length - 1
        out += `${open}…${close}`
      } else {
        // once it fits, every enclosing group is emitted whole
        out += `${open}${inner}${close}`
      }
    } else {
      out += c
    }
  }
  while (enclosing.length) {
    out = `${enclosing.pop()!}${open}${out}`
  }
  return out
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
  ] as const) {
    if (out.length > max) {
      out = elideGroups(out, open, close, max)
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

// Whether a `#stateModel` tag landed on something that can plausibly BUILD a
// model, as opposed to a plain piece of data.
//
// This checks tag ATTACHMENT, not content. TypeScript binds a JSDoc block to
// whatever declaration follows it, so a `const` that lands between a
// `#stateModel` block and its factory quietly takes the tag. The page still
// renders — name and prose come from the comment — but the composition walk now
// searches that `const` instead of the factory and finds no compose call, so
// every inherited member row vanishes with no warning. That is what happened to
// MultiLinearWiggleDisplay (17 rows, silently, for who knows how long).
//
// Three shapes all count as correctly attached, and the middle one is why this
// can't just look for a `types.*` call: a factory may build its model by chaining
// `.views()/.actions()` onto ANOTHER factory's result and never mention `types`
// itself (LinearBasicDisplay, WiggleCommonMixin, the OAuth accounts).
//   - function-like: `function F() {…}` / `const F = () => …`
//   - a variable initialized from a call: `const M = someFactory(…)`
//   - anything containing a literal `types.compose(…)` / `types.model(…)`
//
// Deliberately not `composedOf.length === 0`: a bare `types.model` composes
// nothing legitimately, so an empty composedOf can't tell the two cases apart.
function definesStateModel(node: ts.Node) {
  if (factoryFunction(node)) {
    return true
  }
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isCallExpression(node.initializer)
  ) {
    return true
  }
  let found = false
  const walk = (n: ts.Node) => {
    if (found) {
      return
    }
    if (
      ts.isCallExpression(n) &&
      (isTypesMember(n.expression, 'compose') ||
        isTypesMember(n.expression, 'model'))
    ) {
      found = true
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(node)
  return found
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
// declaration — which is what `definesStateModel` above checks.
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
  const viewType = stringPropValue(arg, 'viewType')
  return displayName && trackType
    ? { displayName, trackType, viewType }
    : undefined
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

// True when `#name` *heads* the comment line, which is how every tag is
// actually written (`* #category general`). The value tags below take the rest
// of the line, so containsTag alone let a mention inside prose ("categorized
// General rather than View, which the #category tag overrides") be parsed as
// the tag — and the value regex, being greedy, then took the text after the
// LAST occurrence on the line. That wrote `sidebar_label: \` tag keeps the ->
// Base1DView` into the generated frontmatter with no error.
export function startsWithTag(text: string, name: string) {
  return new RegExp(`^\\s*\\*?\\s*#${name}(?![A-Za-z0-9_])`).test(text)
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

// The tag half of a node's JSDoc, flattened. TypeScript splits a JSDoc block at
// its first `@tag`: `jd.comment` is the prose before it, `jd.tags` everything
// after. So a docstring whose body opens with `@deprecated` has an empty comment
// and every word after the tag is invisible to the generator — the member
// publishes with a blank Description cell. Reading this side is how
// `assertNoDocsBehindATag` tells that apart from a member nobody documented.
function jsDocTagText(node: ts.Node): string {
  const jsDoc = (node as { jsDoc?: ts.JSDoc[] }).jsDoc
  return (jsDoc ?? [])
    .flatMap(jd => jd.tags ?? [])
    .map(tag =>
      typeof tag.comment === 'string'
        ? tag.comment
        : (tag.comment?.map(part => jsDocPartText(part)).join('') ?? ''),
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

function getOwnJSDocTagText(node: ts.Node): string {
  return jsDocTagText(
    ts.isVariableDeclaration(node) ? node.parent.parent : node,
  )
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
  // the formatter rewraps the rendered callout to the doc's width.
  const endGotcha = () => {
    if (currentGotcha) {
      const text = currentGotcha.join(' ').replaceAll(/\s+/g, ' ').trim()
      if (text) {
        gotchas.push(text)
      }
      currentGotcha = undefined
    }
  }
  // Every tag is matched with startsWithTag, not containsTag: a tag only counts
  // when it heads the line, which is how all of them are actually written. A
  // bare containsTag lets a mention inside prose ("the #category tag overrides
  // it") be parsed as the tag, and the greedy value regexes then take the text
  // after the LAST occurrence on the line — which once wrote a whole sentence
  // into a page's frontmatter with no error.
  for (const line of lines) {
    if (startsWithTag(line, 'example')) {
      endGotcha()
      if (current) {
        examples.push({
          label: current.label,
          content: current.lines.join('\n').trim(),
        })
      }
      current = { label: line.replace(/^.*?#example\s*/, '').trim(), lines: [] }
    } else if (startsWithTag(line, type)) {
      endGotcha()
      const fromTag = line.replace(new RegExp(`^.*?${tag}\\s*`), '').trim()
      if (fromTag) {
        name = fromTag
      }
    } else if (startsWithTag(line, 'category')) {
      endGotcha()
      category = line.replace(/^.*?#category\s*/, '').trim() || undefined
    } else if (startsWithTag(line, 'trackType')) {
      endGotcha()
      trackType = line.replace(/^.*?#trackType\s*/, '').trim() || undefined
    } else if (startsWithTag(line, 'fileFormat')) {
      // Consumed by generateFileTypeDocs (the format -> adapter tables in the
      // file types guide). Dropped here so it doesn't leak into the config
      // page's prose.
      endGotcha()
    } else if (
      startsWithTag(line, 'displayFoundation') ||
      startsWithTag(line, 'displayFoundationDef')
    ) {
      // Consumed by generateDisplayFoundationDocs (the foundations table in the
      // creating_display guide). Dropped here for the same reason as
      // #fileFormat above.
      endGotcha()
    } else if (startsWithTag(line, 'gotcha')) {
      endGotcha()
      currentGotcha = [line.replace(/^.*?#gotcha\s*/, '')]
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
// runtime imports (e.g. theme.ts's MUI). `text` lets a caller that already read
// the file hand it over instead of paying a second read.
export function parseSourceFileSyntactic(file: string, text?: string) {
  return ts.createSourceFile(
    file,
    text ?? fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
}

// Read a file from the getAllFiles() list, or undefined if it is gone. That list
// is a snapshot, and a run spends ~15s in its TypeScript pass before the
// text-scanning generators walk it — long enough for a scratch file another
// process created and removed to still be on the list. `getAllFiles` already
// drops what `git ls-files` reports but the worktree lacks; this covers the file
// that disappears after that check, which otherwise takes the whole run down at
// the last step, with every page already written and the format sweep never
// reached. Only ENOENT is swallowed — any other read error is a real problem.
export function readSourceIfPresent(file: string) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw e
  }
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

export interface ComposeCall {
  // The compose call's own name literal.
  name: string
  // Offset of the call, so a caller can attribute it to the `#stateModel` tag
  // above it.
  pos: number
  // The composed mixins, each reduced to the head identifier of its argument so
  // `TrackHeightMixin()` reads as `TrackHeightMixin`.
  mixins: string[]
}

// Every `types.compose('<name>', A(), B(), types.model({}))` in a file.
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
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'compose'
    ) {
      const [first, ...rest] = node.arguments
      if (first && ts.isStringLiteral(first)) {
        out.push({
          name: first.text,
          pos: node.getStart(),
          mixins: rest.flatMap(arg => {
            let expr: ts.Expression = arg
            while (ts.isCallExpression(expr) || ts.isNonNullExpression(expr)) {
              expr = expr.expression
            }
            return ts.isIdentifier(expr) ? [expr.text] : []
          }),
        })
      }
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

// Prose that keeps its paragraph breaks inside a cell. A cell is one line of
// markdown, so a blank line isn't available — `<br><br>` is what a multi-
// paragraph slot description renders as.
export function proseCell(text: string | undefined) {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map(p => tableCell(p))
    .filter(Boolean)
    .join('<br><br>')
}

// Raw-HTML escaping for a cell: `&`/`<`/`>` so code can't be read as markup,
// `|` so it can't split the row.
function escapeCellHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;')
}

// Newlines inside a cell are written as `&#10;` (the row is one line) and
// line-leading indentation as `&#160;` — ordinary leading spaces are stripped
// by the raw-HTML round trip the table goes through, nbsp survives.
function preCell(code: string) {
  return escapeCellHtml(code.trim()).replace(
    /\n[ \t]*/g,
    m => `&#10;${'&#160;'.repeat(m.length - 1)}`,
  )
}

// Code in a table cell — a slot's default, a member's type signature. Short
// code renders inline; anything longer shows its head and opens in full in a
// dialog, so one 300-character generic type can't blow up the row it sits in.
// Raw `<code>` rather than a markdown code span because these carry backticks
// (jexl defaults are template literals).
const MAX_INLINE_CELL_CODE = 64
export function codeCell(code: string | undefined) {
  const flat = (code ?? '').replace(/\s+/g, ' ').trim()
  return flat
    ? flat.length <= MAX_INLINE_CELL_CODE
      ? `<code>${escapeCellHtml(flat)}</code>`
      : dialogCell(
          `<code>${escapeCellHtml(`${flat.slice(0, MAX_INLINE_CELL_CODE - 1).trimEnd()}…`)}</code>`,
          `<pre><code>${preCell(code ?? '')}</code></pre>`,
        )
    : ''
}

// A value too big for its cell — a 300-character type, a jexl default, an
// authored #example — behind a trigger that opens it in a modal `<dialog>`.
// Expanding it in place (what a `<details>` did) reflows the whole table around
// a multi-line `<pre>` that then has nowhere to go but a quarter-width column;
// the dialog gets the width of the window instead. Native `<dialog>`, so Escape
// and the backdrop click (wired in DocsLayout.astro) close it, and the
// `method="dialog"` form needs no script at all.
function dialogCell(trigger: string, body: string) {
  return [
    '<span class="cell-more">',
    `<button type="button" class="cell-more-trigger">${trigger}</button>`,
    '<dialog class="cell-dialog">',
    '<form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form>',
    body,
    '</dialog>',
    '</span>',
  ].join('')
}

// An authored `#example` inside a table cell. Its prose stays markdown (a cell
// parses as inline markdown, so backticks and links still render); its fenced
// code can't — a fence needs its own lines — so it becomes a `<pre>`.
export function exampleCell(examples: Example[]) {
  return examples
    .map(ex =>
      dialogCell(
        ex.label ? `example: ${ex.label}` : 'example',
        ex.content
          .split(/```[\w]*\n([\s\S]*?)```/)
          .map((part, i) =>
            i % 2
              ? `<pre><code>${preCell(part)}</code></pre>`
              : tableCell(part) && `<p>${tableCell(part)}</p>`,
          )
          .filter(Boolean)
          .join(''),
      ),
    )
    .join('')
}

// A GFM pipe table: header cells, then one already-built `| a | b | c |` row
// per entry. Rows are joined with a single newline (not `section`'s blank-line
// join) since a table's rows must be consecutive lines with no gaps.
//
// `prettier-ignore` pins the compact form. Otherwise the formatter pads every
// cell in a column out to its widest member, so one long slot description
// inflates a whole page (LinearAlignmentsDisplay: 57KB of padding) and editing
// that one description reflows every row into the diff.
export function markdownTable(headers: string[], rows: string[]) {
  return rows.length
    ? [
        '<!-- prettier-ignore -->',
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows,
      ].join('\n')
    : ''
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
  hasExample,
  wantsExample = () => true,
  isGeneralCategory,
}: {
  items: T[]
  getName: (item: T) => string
  hasExample: (item: T) => boolean
  wantsExample?: (item: T) => boolean
  isGeneralCategory: (item: T) => boolean
}) {
  return {
    noExample: items
      .filter(item => wantsExample(item) && !hasExample(item))
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
// prose so it does not duplicate the generated inherited-member rows.
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

// The value of a `#<tag> <value>` line inside a run of `//`-comment text, for
// the generators that read their prose from a comment above a *call or an array
// element* rather than from a JSDoc block on a declaration (the autorun install
// sites, the re-export list). Returns undefined when no line carries the tag.
//
// Two rules, both learned the hard way:
//
//   - the tag must HEAD its line. A comment explaining the convention says the
//     words "#reexport <what it provides>" inside a sentence, and that comment
//     is leading trivia of the first tagged entry — so a substring search
//     documented `@jbrowse/core/Plugin` as "<what it provides>` line,". Same
//     failure `startsWithTag` was added for on the JSDoc side.
//   - the LAST match wins, so the tag nearest the entry is the one read, not
//     whatever appeared earliest in the accumulated trivia.
export function lastTaggedLine(comment: string, tag: string) {
  const value = comment
    .split('\n')
    .filter(line => startsWithTag(line.replace(/^\s*\/\//, ''), tag))
    .at(-1)
    ?.replace(new RegExp(`^.*?#${tag}\\s*`), '')
    .trim()
  return value || undefined
}

// Recursively list every non-test .ts/.tsx source under a directory, skipping
// build output.
export function listSources(dir: string): string[] {
  return walkFiles(dir, isTsSource, BUILD_DIRS)
}

// The sources the text-scanning generators read tags out of, read once.
//
// Five of them used to walk the tree themselves with `listSources` and read
// every file again — five full walks and five full reads per run, and three
// different answers about what "the source tree" is. Two scanned
// `packages`+`plugins` and two `packages`+`plugins`+`products`, so the same tag
// written in a product was documented by one generator and silently ignored by
// the other; and a filesystem walk sees gitignored files, which the
// program-driven half of the pipeline (`getAllFiles`) does not.
//
// So the list comes from `getAllFiles` now, the same list the TypeScript
// program is built over, narrowed to what `listSources` used to yield: no test
// files (a `#extensionPoint` in a fixture is not an extension point) and no
// `.js`, which `getAllFiles` includes for the program's benefit and which
// carries no tags.
export interface SourceCorpus {
  files: string[]
  read: (file: string) => string
}

export function sourceCorpus(files: string[]): SourceCorpus {
  const texts = new Map<string, string>()
  return {
    files: files.filter(f => isTsSource(f.split('/').at(-1)!)),
    read(file) {
      let text = texts.get(file)
      if (text === undefined) {
        text = readSourceIfPresent(file) ?? ''
        texts.set(file, text)
      }
      return text
    },
  }
}

// Recursively list every published .md doc under a directory. Shared by the
// marker-block generators (color/jexl/extension-point) that rewrite tagged
// regions embedded in the hand-written guides.
export function listDocs(dir: string): string[] {
  return walkFiles(dir, isDocFile)
}

// Quote a string for literal use inside a RegExp. The marker generators build
// their patterns out of names read from the docs and the source (a COLOR_TABLE
// group, a GOTCHA config name), which are authored text and so can hold regex
// metacharacters — a placeholder name in a doc *about* the marker syntax is how
// `pnpm gendocs` once died on `<ConfigName>`.
export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The docs both marker sweeps walk. agent-docs is swept alongside the published
// guides: the architecture spec restates several of the same tables the guides
// do, and hand-mirroring one into the other is the drift these generators exist
// to remove — the spec used to carry an explicit "then mirror it here"
// instruction for exactly that. A file is only touched if it holds the marker
// pair, so widening the sweep costs nothing to the docs that don't opt in.
//
// Each marker generator sweeps the whole tree for its own pair, so a run
// relists and rereads these once per marker — 30 sweeps in `markers.ts`, not the
// eight the note here used to be measured against. The relisting stays uncached
// at 1ms a sweep; the rereading is `readDoc`'s, and format.ts says what it cost.
function markerDocs() {
  return [...listDocs('website/docs'), ...listDocs('agent-docs')]
}

// Which docs carry each `<!-- MARKER … START -->` pair, and which markers a
// generator asked to render. The two are checked against each other by
// `assertMarkersAndDocsAgree`; the doc side is also what the MARKER_INDEX table
// renders, so the index is read off the docs rather than off this registry and
// therefore lists itself.
const markersWritten = new Set<string>()

// A marker at the start of a line, which is the only place one can be a block:
// `<!-- NAME START -->` inside a sentence is a doc *about* the convention (that
// is how ARCHITECTURE.md names the pair), and CommonMark reads an HTML comment
// mid-paragraph as inline text, so nothing is spliced there.
const MARKER_BLOCK = /^<!-- ([A-Z][A-Z0-9_]*)(?: (\S+))? START -->$/gm

// The marker names one doc opens a block for. A grouped marker
// (`COLOR_TABLE alignments-indicators`) counts under its base name — the group's
// own existence check is `rewriteGroupedMarkerBlocks`'s `seen`.
export function markerBlockNames(text: string) {
  return [...text.matchAll(MARKER_BLOCK)].map(([, marker]) => marker!)
}

// Every marker pair the docs carry, marker name to the docs carrying it.
export function markerBlocksInDocs() {
  const found = new Map<string, Set<string>>()
  for (const file of markerDocs()) {
    for (const marker of markerBlockNames(readDoc(file))) {
      const docs = found.get(marker)
      if (docs) {
        docs.add(file)
      } else {
        found.set(marker, new Set([file]))
      }
    }
  }
  return found
}

// Both halves of "a generated table and the doc that renders it still know
// about each other", which nothing checked. Either direction is silent and
// permanent, and both are one rename away:
//
//   - a marker no doc carries renders nowhere. The generator reports it up to
//     date, because the docs it did not touch are all identical to themselves.
//     Removing the pair from a page is enough — the table's last reader can go
//     with every gate green, which is the failure `gen-diagram-usage.ts` calls
//     fatal for the same reason.
//   - a pair no generator writes keeps whatever was committed forever. Renaming
//     a marker in the generator is both failures at once: the new name renders
//     nowhere and the old block freezes.
//
// `markersWritten` is what the run actually asked for, so a partial run
// (`markers.ts <filter>`) checks only its own markers; pass `both: false` there,
// since a marker the run never invoked is not evidence of an ungenerated block.
export function assertMarkersAndDocsAgree({ both = true } = {}) {
  const inDocs = markerBlocksInDocs()
  const problems = [
    ...[...markersWritten]
      .filter(marker => !inDocs.has(marker))
      .map(
        marker =>
          `  ${marker} — generated, but no doc carries a \`<!-- ${marker} START -->\` pair. Render it in a doc, or delete the generator.`,
      ),
    ...(both
      ? [...inDocs.keys()]
          .filter(marker => !markersWritten.has(marker))
          .map(
            marker =>
              `  ${marker} — ${[...inDocs.get(marker)!].join(', ')} carries the pair, but no generator writes it. The block keeps whatever was committed.`,
          )
      : []),
  ]
  if (problems.length > 0) {
    throw new Error(
      `${problems.length} marker(s) and the docs disagree:\n${problems.join('\n')}`,
    )
  }
}

// Replace every `<!-- … START -->`/`<!-- … END -->` region in one doc, and fail
// on a START with no matching END. A function replacer keeps any `$`-sequence in
// the rendered block literal.
//
// Both halves are load-bearing, and both used to fail the same silent way. A
// non-global replace rewrote only the FIRST region, so a second block of the
// same marker in one file kept the previous run's table forever — and passed
// `--check`, since the text compared is identical whether or not the second
// block was regenerated. An unterminated START is that failure with no region
// written at all: the doc renders nothing between the markers, the generator
// prints "up to date", and no gate disagrees. Both are authoring mistakes a
// generator has to report, because nothing downstream can.
export function replaceMarkerRegions({
  text,
  startMarker,
  endMarker,
  block,
  file,
}: {
  text: string
  startMarker: string
  endMarker: string
  block: string
  file: string
}) {
  const region = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
    'g',
  )
  // A region is non-greedy, so `START … START … END` matches once and consumes
  // both starts — which is what makes comparing the two counts catch it.
  const starts = text.split(startMarker).length - 1
  const regions = text.match(region)?.length ?? 0
  if (starts !== regions) {
    throw new Error(
      `${file}: ${starts - regions} \`${startMarker}\` with no matching \`${endMarker}\`. The block between them is never generated, and the generator would report the doc as up to date.`,
    )
  }
  return text.replace(
    region,
    () => `${startMarker}\n\n${block}\n\n${endMarker}`,
  )
}

// Rewrite the region between every `<!-- MARKER START -->`/`<!-- MARKER END -->`
// pair in every doc that contains it, returning the docs whose block content
// changed (used by --check to flag stale generated blocks without rewriting).
// Shared by the single-marker generators (jexl catalog, extension-point index);
// the color tables use a per-group variant of the same idea.
//
// The --check comparison is byte-exact, and has to stay that way. It used to
// normalize whitespace and hyphen runs first, from a time when the committed
// tables were column-padded by the formatter and the generators emitted them
// compact — `markdownTable` now pins the compact form with `prettier-ignore`,
// so the two agree byte for byte and the normalization only cost accuracy:
// every cell is already whitespace-collapsed by `tableCell`/`codeCell`, so the
// space clause matched nothing, while the `-+` clause silently passed a stale
// doc whose only change was a hyphen run. Renaming a documented flag from
// `--force` to `-force`, or an em-dash `--` to `-`, regenerated the table and
// reported it up to date.
export function rewriteMarkerBlock(
  marker: string,
  block: string,
  { check = false } = {},
): string[] {
  const startMarker = `<!-- ${marker} START -->`
  const endMarker = `<!-- ${marker} END -->`
  const stale: string[] = []
  markersWritten.add(marker)
  for (const file of markerDocs()) {
    const original = readDoc(file)
    if (original.includes(startMarker)) {
      const updated = replaceMarkerRegions({
        text: original,
        startMarker,
        endMarker,
        block,
        file,
      })
      if (check) {
        if (updated !== original) {
          stale.push(file)
        }
      } else if (updated !== original) {
        writeDoc(file, updated)
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
//
// Sweeps the same docs as `rewriteMarkerBlock`, agent-docs included. It used to
// walk website/docs alone, which made a grouped block in agent-docs worse than
// unsupported: the block silently kept whatever was committed, and — because
// `seen` is what tells a caller a tagged group reached some page — the group it
// rendered read as rendered by nothing, so `writeColorDocs`/`writeFileTypeDocs`
// would abort the whole run over a group that was in fact in use.
export function rewriteGroupedMarkerBlocks(
  marker: string,
  render: (group: string, file: string) => string,
  { check = false } = {},
) {
  const markerRe = new RegExp(`<!-- ${marker} (\\S+) START -->`, 'g')
  const stale: string[] = []
  const seen = new Set<string>()
  markersWritten.add(marker)
  for (const file of markerDocs()) {
    const original = readDoc(file)
    let updated = original
    // A group repeated in one doc matches twice; rendering it twice is
    // wasted work, not a wrong answer, and dropping the duplicate keeps the
    // per-group replace from running over text it already rewrote.
    for (const group of new Set(
      [...original.matchAll(markerRe)].map(m => m[1]!),
    )) {
      seen.add(group)
      updated = replaceMarkerRegions({
        text: updated,
        startMarker: `<!-- ${marker} ${group} START -->`,
        endMarker: `<!-- ${marker} ${group} END -->`,
        block: render(group, file),
        file,
      })
    }
    if (check) {
      if (updated !== original) {
        stale.push(file)
      }
    } else if (updated !== original) {
      writeDoc(file, updated)
    }
  }
  return { stale, seen }
}

// Every source file the generators document, tracked plus untracked-but-not-
// ignored (`--others --exclude-standard`).
//
// Without `--others` a brand-new file is invisible until it is `git add`ed, and
// not just to the tag scan: the TypeScript program can't resolve imports of it
// either, so every signature that flows through it silently degrades to `any`.
// That reads as a mysterious doc regression with no cause in the diff, and it is
// local-only — CI has nothing untracked, so the two disagree. `--exclude-standard`
// keeps ignored scratch files out, leaving exactly the files that are about to be
// committed anyway.
//
// The `plugins` alternative is deliberately unanchored: it also matches
// `example-plugins/`, the worked examples backing the developer guides, whose
// LinearScoreDisplay config and model are documented pages.
export async function getAllFiles() {
  const { stdout } = await exec2(
    String.raw`git ls-files --cached --others --exclude-standard | grep "\(plugins\|products\|packages\).*\.\(t\|j\)sx\?$"`,
  )
  // `git ls-files` also lists files staged as added but since deleted from the
  // worktree, which every generator downstream would then try to read.
  return stdout.split('\n').filter(f => f && fs.existsSync(f))
}
