import path from 'path'

import * as ts from 'typescript'

import {
  isSchemaCall,
  isTypesCall,
  returnedExpression,
  schemaCallName,
} from './astShapes.ts'
import {
  definesStateModel,
  findStringLiteral,
  referencedDeclId,
  resolveComposedModels,
} from './composition.ts'
import {
  assertNoDocsBehindATag,
  assertNoUntaggedSlots,
  collectDocsBehindATag,
  collectUntaggedSlots,
} from './docAsserts.ts'
import {
  buildEnumConstantIndex,
  slotSpreadPairs,
  slotSpreadPart,
} from './enumConstants.ts'
import {
  TAG_TYPES,
  getOwnJSDocText,
  isMemberTag,
  parseTaggedComment,
  startsWithTag,
} from './jsDocTags.ts'
import {
  assertNoUnresolvedDelegations,
  collectDelegatedClaims,
  delegatedBlockAt,
  emitDelegatedMembers,
  emitUntaggedMember,
  memberKey,
  memberNode,
} from './mstMembers.ts'
import {
  describeSymbol,
  followAlias,
  nodeBase,
  symbolDeclId,
} from './symbols.ts'
import { printedTypes, writtenFunction } from './typeSignatures.ts'
import { removeComments, repoRelative } from './util.ts'

import type { ConfigSlotGap, DocsBehindTagGap } from './docAsserts.ts'
import type { ConstantIndex } from './enumConstants.ts'
import type { MemberTag, TagType } from './jsDocTags.ts'
import type { BlindSpot } from './mstMembers.ts'
import type { Described } from './symbols.ts'

export interface NodeBase {
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
}

export interface ReachedSchema {
  name: string
  list: boolean
}

export interface SlotNode extends NodeBase {
  type: 'slot'
  // The dotted path of the sub-schemas the slot sits in (`scale.`), which a
  // tag naming the slot alone leaves out
  slotPrefix?: string
  // For a `#slot` a spread's JSDoc documents: the row name the spread gives
  // the slot undocumented, which a dotted tag (`configuration.shareURL`)
  // replaces
  spreadSlot?: string
  // The declIds a slot's value expression names, nearest first (`facet:
  // facetConfigSchema`; `encoding: yEncodingSchema(...)`), so its row can link
  // the page of the first one that is a `#config`.
  valueDeclIds?: string[]
  // The `ConfigurationSchema('Name', …)` declarations the same walk reaches,
  // each marked when a `types.array` holds it, so a slot a factory builds
  // (`markListSchema([...])`) can link the rows that document its schema on
  // whichever page has them.
  valueSchemas?: ReachedSchema[]
  // What the factory the slot's value calls returns
  // (`types.array(types.union(...))` for
  // `multiQuantitativeDisplaySchemas(pluginManager)`).
  valueReturnedCode?: string
  // Whether the slot's `defaultValue` names a parameter of the factory
  // declaring it, so the value is whatever each caller passed and the source
  // text names nothing a reader can look up.
  parameterisedDefault?: boolean
}

interface BaseConfigurationNode extends NodeBase {
  type: 'baseConfiguration'
  // The declId of the base config the right-hand-side expression references
  // (alias-followed). undefined when the base can't be resolved statically
  // (e.g. `pluginManager.getDisplayType(...)`).
  baseDeclId?: string
  // A string literal found in the RHS, used as a name fallback when declId
  // resolution fails — e.g.
  // `pluginManager.getDisplayType('LinearWiggleDisplay')!.configSchema` links to
  // the config named "LinearWiggleDisplay".
  baseConfigName?: string
}

interface StateModelNode extends NodeBase {
  type: 'stateModel'
  // The models passed to this model's `types.compose(...)` call,
  // alias-followed. Lets the state-model generator derive the composition
  // graph from code instead of a hand-authored `composed of` comment, the same
  // way `baseDeclId` derives config inheritance.
  composedOf: ComposedRef[]
  // Whether the annotated declaration actually contains a `types.model` /
  // `types.compose` call. False means the tag is attached to something else —
  // the failure this catches is a declaration sliding in between the JSDoc and
  // its factory, which still renders a page (the header parses from the
  // comment) while `composedOf` resolves empty, so every inherited member
  // silently vanishes from the table. See the misattached-#stateModel gap
  // section in generate.ts.
  definesModel: boolean
}

export interface ApiNode extends NodeBase {
  type: 'api'
  // A type or interface, whose `signature` is its declaration
  declaresType: boolean
}

interface MemberNode extends NodeBase {
  type: MemberTag
  // For a `#property`: what MST fills the property with when a snapshot leaves
  // it out
  propertyDefault?: string
}

export type ExtractedNode =
  | SlotNode
  | BaseConfigurationNode
  | StateModelNode
  | ApiNode
  | MemberNode
  | (NodeBase & { type: 'config' | 'identifier' | 'preProcessSnapshot' })

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

// The whole-repo TypeScript program plus the subset of its source files that
// belong to this repo — the program also parses node_modules and lib `.d.ts` to
// resolve types, which document nothing.
//
// Building the program is the dominant cost of a run (~10s), so it is built once
// here and every pass that needs an AST reads `sources` rather than reparsing.
// The enum-constant index used to `createSourceFile` all ~4000 files itself,
// paying a second full parse (~4s) for trees the program already had; it is
// built here from `sources`, before any pass that resolves a name through it.
interface DocProgram {
  program: ts.Program
  sources: ts.SourceFile[]
  constants: ConstantIndex
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
  const sources = program
    .getSourceFiles()
    .filter(sf => !sf.isDeclarationFile && roots.has(path.resolve(sf.fileName)))
  return { program, sources, constants: buildEnumConstantIndex(sources) }
}

export function extractWithComment(
  { program, sources, constants }: DocProgram,
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
  const named = printedTypes(checker, sources)
  // Member-tagged nodes in files that document no #stateModel and that no model
  // claimed. Each renders on no page — see `orphanMembers`.
  const memberTagged = new Map<string, string>()

  for (const sourceFile of sources) {
    // Structural member detection only runs in files that document a
    // #stateModel, and the untagged-slot audit only in files that document a
    // #config, so helper files with their own .actions() chains or internal
    // ConfigurationSchema calls don't contribute spurious members/gaps.
    const text = sourceFile.getFullText()
    const isStateModel = startsWithTag(text, 'stateModel')
    const isConfig = startsWithTag(text, 'config')
    ts.forEachChild(sourceFile, node => {
      visit(node, isStateModel, isConfig)
    })
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
    orphanMembers: [...memberTagged]
      .filter(([key]) => !claimed.has(key))
      .map(([, label]) => label),
  }

  function visit(node: ts.Node, isStateModel: boolean, isConfig: boolean) {
    for (const link of displayTrackLinks(node)) {
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
          named,
          delegated,
          node.getSourceFile().fileName,
          cb,
        )
      }
    }
    const comment = getOwnJSDocText(node)
    const tags = comment ? TAG_TYPES.filter(t => startsWithTag(comment, t)) : []
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
    if (ts.isVariableStatement(node) && tags.length) {
      // Each declaration under it reads this JSDoc (getOwnJSDocText) and is
      // visited next, with a name to carry it.
    } else if (ts.isSpreadAssignment(node) && tags.includes('slot')) {
      emitSpreadSlots(constants, node, comment, cb)
    } else if (tags.length && !delegatedAway) {
      const described = describeSymbol(
        checker,
        named,
        node,
        tags.includes('property'),
        tags.includes('api') ? Infinity : undefined,
      )
      const filename = node.getSourceFile().fileName
      if (!isStateModel && tags.some(isMemberTag)) {
        memberTagged.set(
          memberKey(node),
          `${repoRelative(filename)} ${described.name}`,
        )
      }
      const base = nodeBase(
        described,
        comment,
        (tags.includes('slot') && slotTableEntry(node)) || node.getFullText(),
        filename,
      )
      collectDocsBehindATag(node, comment, described.name, behindATag)
      for (const type of tags) {
        cb(taggedNode(checker, node, type, base, described))
      }
    } else if (isStateModel) {
      // Untagged members are recovered structurally from their position in the
      // MST factory chain. A node either has a tag (handled above, unchanged) or
      // is examined here, so no member is ever emitted twice.
      emitUntaggedMember(checker, named, node, comment, cb, blindSpots)
    }
    ts.forEachChild(node, n => {
      visit(n, isStateModel, isConfig)
    })
  }
}

// A `#slot` on a shared one-slot table (`export const colorTitleSlot = { title:
// {...} } as const`) documents the slot inside it, so its source is that entry.
function slotTableEntry(node: ts.Node) {
  let init = ts.isVariableDeclaration(node) ? node.initializer : undefined
  while (init && ts.isAsExpression(init)) {
    init = init.expression
  }
  return init &&
    ts.isObjectLiteralExpression(init) &&
    init.properties.length === 1
    ? init.properties[0]?.getText()
    : undefined
}

// A JSDoc above a spread documents the slots it brings in, one `#slot <name>`
// section each, so they render at the spread's position with that prose.
// Each section's source is the slot the spread produces, read the way the
// config generator reads an undocumented spread (`slotSpreadPart`).
function emitSpreadSlots(
  constants: ConstantIndex,
  node: ts.SpreadAssignment,
  comment: string,
  cb: (obj: ExtractedNode) => void,
) {
  const sf = node.getSourceFile()
  const where = `${repoRelative(sf.fileName)}: the JSDoc on \`...${node.expression.getText(sf)}\``
  const part = slotSpreadPart(node.expression, sf)
  const prefix = subSchemaPrefix(node)
  const produced = new Map(
    ((part && slotSpreadPairs(constants, part)) ?? []).map(([name, value]) => [
      `${prefix}${name}`,
      `${name}: ${value}`,
    ]),
  )
  const [lead, ...sections] = slotSections(comment)
  if (lead?.trim()) {
    throw new Error(
      `${where} has prose before its first \`#slot\`, which documents no slot. Move it under the \`#slot\` it describes.`,
    )
  }
  for (const section of sections) {
    const name = /#slot[ \t]+(\S+)/.exec(section)?.[1]
    const spreadSlot = name?.includes('.')
      ? `${prefix}${name.slice(name.lastIndexOf('.') + 1)}`
      : name
    const code = spreadSlot && produced.get(spreadSlot)
    if (!name || !code) {
      throw new Error(
        `${where} documents \`#slot ${name ?? ''}\`, which the spread does not bring in. It brings in: ${[...produced.keys()].join(', ') || 'nothing the generator can read'}.`,
      )
    }
    cb({
      type: 'slot',
      name,
      spreadSlot,
      comment: section,
      signature: '',
      node: code,
      filename: sf.fileName,
    })
  }
}

function slotSections(comment: string) {
  const sections = ['']
  for (const line of comment.split('\n')) {
    if (startsWithTag(line, 'slot')) {
      sections.push(line)
    } else {
      sections[sections.length - 1] += `\n${line}`
    }
  }
  return sections
}

// The dotted path a slot in a nested sub-schema is documented under
// (`index.indexType`), matching what a hand-written `#slot` tag names there.
function subSchemaPrefix(slot: ts.Node): string {
  const schema = slot.parent.parent
  const prop = schema.parent
  return isSchemaCall(schema) &&
    ts.isPropertyAssignment(prop) &&
    ts.isIdentifier(prop.name) &&
    isSchemaCall(prop.parent.parent)
    ? `${subSchemaPrefix(prop)}${prop.name.text}.`
    : ''
}

// One tag's node: the fields every node carries plus what that tag's consumer
// reads off the declaration.
function taggedNode(
  checker: ts.TypeChecker,
  node: ts.Node,
  type: TagType,
  base: NodeBase,
  described: Described,
): ExtractedNode {
  return type === 'slot'
    ? {
        ...base,
        type,
        ...slotValueReferences(checker, node),
        parameterisedDefault: hasParameterisedDefault(checker, node),
        slotPrefix: subSchemaPrefix(node),
      }
    : type === 'baseConfiguration'
      ? {
          ...base,
          type,
          baseDeclId: referencedDeclId(checker, node),
          baseConfigName: ts.isPropertyAssignment(node)
            ? findStringLiteral(node.initializer)
            : undefined,
        }
      : type === 'stateModel'
        ? {
            ...base,
            type,
            composedOf: resolveComposedModels(checker, node),
            definesModel: definesStateModel(node),
          }
        : type === 'api'
          ? { ...base, type, declaresType: described.declaresType }
          : isMemberTag(type)
            ? memberNode(type, base, described)
            : { ...base, type }
}

// Whether a slot's `defaultValue` names a parameter of the factory that
// declares the slot — `symlogConstant: { defaultValue: symlogConstant }`, where
// the schema is built per display. Undefined rather than false so the flag only
// ever appears on the slots it describes.
function hasParameterisedDefault(checker: ts.TypeChecker, node: ts.Node) {
  if (
    !ts.isPropertyAssignment(node) ||
    !ts.isObjectLiteralExpression(node.initializer)
  ) {
    return undefined
  }
  const dflt = node.initializer.properties.find(
    p =>
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === 'defaultValue',
  )
  if (!dflt || !ts.isPropertyAssignment(dflt)) {
    return undefined
  }
  let expr: ts.Expression = dflt.initializer
  while (ts.isPropertyAccessExpression(expr)) {
    expr = expr.expression
  }
  const decl = ts.isIdentifier(expr)
    ? checker.getSymbolAtLocation(expr)?.declarations?.[0]
    : undefined
  return decl && bindsAParameter(decl) ? true : undefined
}

// A declaration that is a parameter, or a name destructured out of one.
function bindsAParameter(decl: ts.Declaration) {
  let n: ts.Node | undefined = decl
  while (
    n &&
    (ts.isBindingElement(n) ||
      ts.isObjectBindingPattern(n) ||
      ts.isArrayBindingPattern(n))
  ) {
    n = n.parent
  }
  return !!n && ts.isParameter(n)
}

// How many calls, arguments and returns deep the walk below follows a slot's
// value. A display's `filter` reaches its predicate schema at 5:
// `fieldPredicateList()` returns `listMergedBy(plotList(type))`, whose `type`
// is a local holding `fieldPredicateArray()`'s `types.array`.
const SLOT_VALUE_DEPTH = 6

// Every declaration a sub-schema slot's value expression names, nearest first.
// `facet: facetConfigSchema` names one; `encoding: yEncodingSchema(yChannelSchema())`
// names a factory whose schema is built by a call further in, so the walk goes
// through a callee's returned expression and through a call's arguments as well
// as its head. The caller keeps the first that is a `#config`, which is what
// decides the page a row links to, and falls back to the rows documenting the
// first `ConfigurationSchema` the walk names.
function slotValueReferences(checker: ts.TypeChecker, node: ts.Node) {
  if (!ts.isPropertyAssignment(node)) {
    return {}
  }
  const ids: string[] = []
  const schemas: ReachedSchema[] = []
  const seen = new Set<string>()
  const head = ts.isCallExpression(node.initializer)
    ? node.initializer.expression
    : undefined
  let returnedCode: string | undefined
  const queue = [{ expr: node.initializer, depth: 0, list: false }]
  for (let item = queue.shift(); item; item = queue.shift()) {
    const { expr, depth, list } = item
    if (depth > SLOT_VALUE_DEPTH) {
      continue
    }
    if (ts.isNonNullExpression(expr) || ts.isParenthesizedExpression(expr)) {
      queue.push({ expr: expr.expression, depth, list })
    } else if (ts.isCallExpression(expr)) {
      queue.push({ expr: expr.expression, depth, list })
      const inArray = list || isTypesCall(expr, 'array')
      for (const arg of expr.arguments) {
        queue.push({ expr: arg, depth: depth + 1, list: inArray })
      }
    } else if (ts.isIdentifier(expr)) {
      const symbol = checker.getSymbolAtLocation(expr)
      const id = symbolDeclId(checker, symbol)
      if (!id || seen.has(id)) {
        continue
      }
      seen.add(id)
      ids.push(id)
      const decl = symbol && followAlias(checker, symbol).declarations?.[0]
      const init =
        decl && ts.isVariableDeclaration(decl) ? decl.initializer : undefined
      const name = init && schemaCallName(init)
      if (name) {
        schemas.push({ name, list })
      }
      const fn = decl && writtenFunction(decl)
      const returned = fn && returnedExpression(fn)
      if (returned) {
        if (expr === head) {
          returnedCode = returned.getText()
        }
        queue.push({ expr: returned, depth: depth + 1, list })
      }
      // A factory's schema may arrive as a parameter's default
      // (`entry = fieldPredicateConfigSchema`) or through a local
      // (`const type = fieldPredicateArray()`), and both are its value.
      for (const param of fn?.parameters ?? []) {
        if (param.initializer) {
          queue.push({ expr: param.initializer, depth: depth + 1, list })
        }
      }
      if (!fn && init && !name) {
        queue.push({ expr: init, depth: depth + 1, list })
      }
    }
  }
  return {
    valueDeclIds: ids.length ? ids : undefined,
    valueSchemas: schemas.length ? schemas : undefined,
    valueReturnedCode: returnedCode,
  }
}

// Matches `new DisplayType({ name: 'X', trackType: 'Y', ... })` — the only
// place in the codebase a Display declares which Track it attaches to — and
// emits one link per track type, since `trackType` may be an array. Plain
// structural pattern match, not tied to any import path, so it also catches a
// default-imported local alias.
function displayTrackLinks(node: ts.Node): DisplayTrackLink[] {
  if (
    !ts.isNewExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== 'DisplayType'
  ) {
    return []
  }
  const arg = node.arguments?.[0]
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    return []
  }
  const displayName = stringPropValue(arg, 'name')
  const viewType = stringPropValue(arg, 'viewType')
  return displayName
    ? stringPropValues(arg, 'trackType').map(trackType => ({
        displayName,
        trackType,
        viewType,
      }))
    : []
}

function propInitializer(obj: ts.ObjectLiteralExpression, key: string) {
  return obj.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === key,
  )?.initializer
}

// The string-literal value of a `key: '...'` property in an object literal, or
// undefined when the property is absent or not a plain string literal.
function stringPropValue(obj: ts.ObjectLiteralExpression, key: string) {
  const init = propInitializer(obj, key)
  return init && ts.isStringLiteral(init) ? init.text : undefined
}

// The string literals of a `key: '...'` or `key: ['...', '...']` property.
function stringPropValues(obj: ts.ObjectLiteralExpression, key: string) {
  const init = propInitializer(obj, key)
  if (!init) {
    return []
  }
  const literals: ts.Expression[] = ts.isArrayLiteralExpression(init)
    ? [...init.elements]
    : [init]
  return literals.filter(ts.isStringLiteral).map(l => l.text)
}

// Parse one extracted node into the fields the config and state-model generators
// both build their Item/Member records from: the tag-parsed name/docs/examples/
// category, plus the comment-stripped source and type signature. Shared so the
// two near-identical buildItem/buildMember helpers don't drift.
export function parseNode(obj: ExtractedNode) {
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
    propertyDefault: 'propertyDefault' in obj ? obj.propertyDefault : undefined,
  }
}
