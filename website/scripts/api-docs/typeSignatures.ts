import * as ts from 'typescript'

import { typesMemberName } from './astShapes.ts'
import {
  getOwnJSDocText,
  parseTaggedComment,
  startsWithTag,
} from './jsDocTags.ts'
import { MAX_INLINE_CELL_CODE } from './markdown.ts'
import {
  elideSignature,
  functionParts,
  groupEnd,
  MAX_SIGNATURE,
  scanGroups,
  tidyType,
  unwrapBefore,
} from './typeText.ts'

const writtenPrinter = ts.createPrinter({ removeComments: true })

const MST_EXPANSION =
  /ModelInstanceTypeProps|IModelType|ModelCreationType|ModelSnapshotType|IOptionalIType|ISimpleType|IMSTArray|ExtractCFromProps|ConfigNodeProps/

// A whole type, or a function's whole return, that elision collapsed to its
// outer name: `Promise<{…}>`, `Record<…>`.
const COLLAPSED = /(?:^|=> )[\w.]+<(?:…|\{…\})>(?: \| undefined)?$/

// MST's own vocabulary in what the checker inferred. A parameter can take
// these (`runLazyAfterAttach<Self extends IStateTreeNode>`), so they count
// only in a return or a value's whole type; `typeof self` names nothing
// anywhere.
const INFERRED_LEAK = /\b(?:IStateTreeNode|IAnyType|SnapshotIn)\b/

// A rendered signature a reader cannot use: one line of it prints an MST
// expansion, leaks MST's vocabulary into what it returns, or collapses to
// nothing.
export function unreadableSignature(sig: string) {
  return sig
    .split('\n')
    .some(
      line =>
        MST_EXPANSION.test(line) ||
        COLLAPSED.test(line) ||
        line.includes('typeof self') ||
        INFERRED_LEAK.test(functionParts(line)?.returns ?? line),
    )
}

const LITERAL_UNION =
  /^(?:"(?:[^"\\]|\\.)*"|undefined)(?: \| (?:"(?:[^"\\]|\\.)*"|undefined))+$/

// Source as one line: a tuple written across lines prints as `[ A, B ]`, and
// an object or call across lines keeps its trailing comma.
function print(node: ts.Node) {
  return writtenPrinter
    .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    .replace(/\s+/g, ' ')
    .replace(/\[ /g, '[')
    .replace(/ \]/g, ']')
    .replace(/,( [}\])])/g, '$1')
}

// The checker prints an alias's expansion wherever the alias is generic or
// resolves through one: `setViews(views: SnapshotIn<LinearGenomeViewModel>[])`
// printed as `LaunchSnapshotIn<IModelType<…>, …>[]`. Each parameter and return
// type the source writes reads as written where the checker's print of it is
// an MST expansion, or too long for a cell and longer than what the author
// wrote. A union of string literals stays at any length, since it lists the
// values a caller passes, such as `setUnit`'s `"chain" | "read"`. A
// `typeof` query names nothing a reader can look up, so it never replaces a
// print that isn't an expansion.
function writtenSignature(
  checker: ts.TypeChecker,
  named: PrintedType[],
  decl: ts.Declaration,
  type: ts.Type,
) {
  const part = (node: ts.TypeNode | undefined, inferred: ts.Type) => {
    const printed = dropNodeTails(
      nameTypes(
        named,
        checker.typeToString(
          inferred,
          undefined,
          ts.TypeFormatFlags.NoTruncation,
        ),
      ),
    )
    const written = node && print(node)
    const better =
      !!written &&
      (MST_EXPANSION.test(printed) ||
        (!hasTypeQuery(node) &&
          !LITERAL_UNION.test(printed) &&
          printed.length > MAX_INLINE_CELL_CODE &&
          written.length < printed.length))
    return { text: better ? written : printed, written: better }
  }
  if (ts.isGetAccessorDeclaration(decl)) {
    const value = part(decl.type, type)
    return value.written ? value.text : undefined
  }
  const fn = writtenFunction(decl)
  const signature = fn && checker.getSignatureFromDeclaration(fn)
  if (!fn || !signature) {
    return undefined
  }
  const parameters = fn.parameters.map(p => {
    const inferred = checker.getTypeAtLocation(p)
    return {
      p,
      type:
        p.initializer && inferred.flags & ts.TypeFlags.Any
          ? { text: initializerType(checker, p.initializer), written: true }
          : part(p.type, inferred),
    }
  })
  const returns = part(fn.type, signature.getReturnType())
  if (!returns.written && !parameters.some(({ type }) => type.written)) {
    return undefined
  }
  const typeParameters = fn.typeParameters
    ? `<${fn.typeParameters.map(print).join(', ')}>`
    : ''
  const list = parameters.map(
    ({ p, type }) =>
      `${p.dotDotDotToken ? '...' : ''}${bindingName(p.name)}${p.questionToken || p.initializer ? '?' : ''}: ${type.text}`,
  )
  return `${typeParameters}(${list.join(', ')}) => ${returns.text}`
}

// MST's `ModelActions` index signature types an action's unannotated
// parameters `any`, so `hideTrack(trackId, level = 0)` reads `level?: any`
// where its default says `number`.
function initializerType(checker: ts.TypeChecker, initializer: ts.Expression) {
  return checker.typeToString(
    checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(initializer)),
  )
}

function hasTypeQuery(node: ts.Node): boolean {
  return ts.isTypeQueryNode(node) || !!ts.forEachChild(node, hasTypeQuery)
}

// A parameter's name as the checker prints it: a destructuring pattern
// without its defaults.
function bindingName(name: ts.BindingName): string {
  if (ts.isIdentifier(name)) {
    return name.text
  }
  const elements = name.elements.map(e =>
    ts.isOmittedExpression(e)
      ? ''
      : `${e.dotDotDotToken ? '...' : ''}${e.propertyName ? `${e.propertyName.getText()}: ` : ''}${bindingName(e.name)}`,
  )
  return ts.isObjectBindingPattern(name)
    ? `{ ${elements.join(', ')} }`
    : `[${elements.join(', ')}]`
}

// The function a declaration is: a method, a function, or a property or const
// holding an arrow or function expression — a member, an `#api` export, or a
// model factory.
export function writtenFunction(node: ts.Node) {
  const init =
    ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node)
      ? node.initializer
      : undefined
  return ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)
    ? node
    : init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
      ? init
      : undefined
}

// A member of an object literal whose type is written elsewhere, as in
// `.volatile((): State => ({ x: undefined }))`, reads as that written type
// rather than its initializer's `undefined`.
function declaredType(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  decl: ts.Declaration,
) {
  const written =
    ts.isPropertyAssignment(decl) && ts.isObjectLiteralExpression(decl.parent)
      ? checker.getContextualType(decl.parent)?.getProperty(symbol.getName())
      : undefined
  return checker.getTypeOfSymbolAtLocation(written ?? symbol, decl)
}

// A member's rendered type. `typeToString` truncates past ~340 characters by
// cutting mid-token — leaving unbalanced brackets and half a word, which is
// worse than no type at all (a display's `configuration` printed 340 characters
// of expanded config schema ending in "including c..."). When that happens,
// re-render untruncated and shorten structurally instead, so the type still
// reads as a type.
export function typeSignature(
  checker: ts.TypeChecker,
  named: PrintedType[],
  symbol: ts.Symbol,
  decl: ts.Declaration,
  max = MAX_SIGNATURE,
) {
  const type = declaredType(checker, symbol, decl)
  const written = writtenSignature(checker, named, decl, type)
  if (written) {
    return shortenSignature(written, max)
  }
  const overloads = type.getCallSignatures()
  // An overloaded function prints as one object type of call signatures, which
  // elision then collapses whole. One arrow per line reads as what it is.
  if (overloads.length > 1 && type.getProperties().length === 0) {
    return overloads
      .map(overload =>
        shortenSignature(
          nameTypes(
            named,
            checker.signatureToString(
              overload,
              decl,
              ts.TypeFormatFlags.NoTruncation |
                ts.TypeFormatFlags.WriteArrowStyleSignature,
            ),
          ),
          max,
        ),
      )
      .join('\n')
  }
  const printed = checker.typeToString(type)
  return shortenSignature(
    TRUNCATED.test(printed)
      ? nameTypes(
          named,
          checker.typeToString(
            type,
            undefined,
            ts.TypeFormatFlags.NoTruncation,
          ),
        )
      : printed,
    max,
  )
}

// The checker forgets an alias like `CircularViewModel = Instance<…>` once it
// resolves, so a member returning another model prints that model's whole
// expanded type, which elision then reduces to `ModelInstanceTypeProps<…> & {…}
// & {…} & …`. Each documented model's and config schema's instance type prints
// as the same text wherever it appears, so `nameTypes` swaps that text for the
// model's page name before eliding. A config node becomes `<schema>Config`, the
// codebase's own spelling, which keeps `LinearBasicDisplayConfig` apart from the
// `LinearBasicDisplay` model.
//
// A model's match stops short of its trailing `& IStateTreeNode<…>`, which
// names the MST type holding the node. A model held as `types.optional(M, {})`
// prints `IStateTreeNode<IOptionalIType<…>>` there and is still M. A node that
// extends M in place keeps its extra members, as in `Dotplot1DView & {
// readonly width: … }`.
export interface PrintedType {
  name: string
  body: string
  isModel: boolean
}

const NODE_TAIL = ' & IStateTreeNode<'

export function printedTypes(
  checker: ts.TypeChecker,
  sources: readonly ts.SourceFile[],
) {
  const byBody = new Map<string, PrintedType>()
  for (const sourceFile of sources) {
    const text = sourceFile.getFullText()
    const tags = (['stateModel', 'config'] as const).filter(tag =>
      startsWithTag(text, tag),
    )
    if (/\.test\.tsx?$/.test(sourceFile.fileName) || !tags.length) {
      continue
    }
    const walk = (node: ts.Node) => {
      const comment = getOwnJSDocText(node)
      const tag = comment && tags.find(t => startsWithTag(comment, t))
      const instance = tag && instanceType(checker, node)
      if (tag && instance) {
        const printed = checker.typeToString(
          instance,
          undefined,
          ts.TypeFormatFlags.NoTruncation,
        )
        const isModel = tag === 'stateModel'
        const body = isModel ? nodeBody(printed) : printed
        const { name } = parseTaggedComment(comment, tag, '')
        if (body && name && !byBody.has(body)) {
          byBody.set(body, {
            name: isModel ? name : configNodeName(name),
            body,
            isModel,
          })
        }
      }
      ts.forEachChild(node, walk)
    }
    ts.forEachChild(sourceFile, walk)
  }
  return [...byBody.values()].sort((a, b) => b.body.length - a.body.length)
}

export function configNodeName(schema: string) {
  return schema.endsWith('Config') ? schema : `${schema}Config`
}

// MST's `IType` declares its instance type as a `Type` property, and a
// configuration schema is an `IType`. A factory's model is its return type.
function instanceType(checker: ts.TypeChecker, node: ts.Node) {
  const fn = writtenFunction(node)
  const signature = fn && checker.getSignatureFromDeclaration(fn)
  const type = signature
    ? checker.getReturnTypeOfSignature(signature)
    : ts.isVariableDeclaration(node)
      ? checker.getTypeAtLocation(node)
      : undefined
  const instance = type?.getProperty('Type')
  return instance && checker.getTypeOfSymbolAtLocation(instance, node)
}

// A model instance's text without its outermost `& IStateTreeNode<…>`, which
// has to be the last thing in it.
function nodeBody(text: string) {
  const at = scanGroups(
    text,
    0,
    (i, depth, mark) =>
      mark === 'text' &&
      depth === 0 &&
      text.startsWith(NODE_TAIL, i) &&
      groupEnd(text, i + NODE_TAIL.length - 1) === text.length,
  )
  return at < 0 ? undefined : text.slice(0, at)
}

// Where a match of `body` at `at` ends, and the member groups a node adds to
// a model; -1 when the text there is not the whole instance.
function matchEnd(sig: string, at: number, { body, isModel }: PrintedType) {
  let end = at + body.length
  const extras: string[] = []
  if (!isModel) {
    return { end, extras }
  }
  while (sig.startsWith(' & {', end)) {
    const close = groupEnd(sig, end + 3)
    extras.push(sig.slice(end + 3, close))
    end = close
  }
  return {
    end: sig.startsWith(NODE_TAIL, end)
      ? groupEnd(sig, end + NODE_TAIL.length - 1)
      : -1,
    extras,
  }
}

export function nameTypes(types: PrintedType[], sig: string) {
  let out = sig
  for (const type of types) {
    let at = type.body.length <= out.length ? out.indexOf(type.body) : -1
    while (at >= 0) {
      const { end, extras } = matchEnd(out, at, type)
      if (end > 0) {
        const replacement = [type.name, ...extras].join(' & ')
        out = unwrapBefore(
          out.slice(0, at) + replacement + out.slice(end),
          at + replacement.length,
        )
        at = out.indexOf(type.body, at)
      } else {
        at = out.indexOf(type.body, at + 1)
      }
    }
  }
  return out
}

// A node's `& IStateTreeNode<…>` names the MST type holding it, which nothing a
// reader does with the member depends on: `PluggableConfigNode &
// IStateTreeNode<PluggableConfigSchemaType>` is a `PluggableConfigNode`.
export function dropNodeTails(sig: string) {
  let out = sig
  for (let at = out.indexOf(NODE_TAIL); at >= 0;) {
    const end = groupEnd(out, at + NODE_TAIL.length - 1)
    if (end < 0) {
      break
    }
    out = unwrapBefore(out.slice(0, at) + out.slice(end), at)
    at = out.indexOf(NODE_TAIL, Math.max(0, at - 1))
  }
  return out
}

// The marks the checker leaves: a cut at the end, a count where it dropped
// members from the middle of a nested type, and a nested group emptied whole.
const TRUNCATED = /\.\.\.$|\.\.\. \d+ more \.\.\.|<\.\.\.>|\{ \.\.\.; \}/

function shortenSignature(sig: string, max: number) {
  return elideSignature(sortUnionMembers(tidyType(dropNodeTails(sig))), max)
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
const STRING_LITERAL = /"(?:[^"\\]|\\.)*"/g
const STRING_LITERAL_UNION = /"(?:[^"\\]|\\.)*"(?:\s*\|\s*"(?:[^"\\]|\\.)*")+/g

export function sortUnionMembers(sig: string) {
  return sig.replaceAll(STRING_LITERAL_UNION, run =>
    run.match(STRING_LITERAL)!.sort().join(' | '),
  )
}

// A `#property` as MST reads its declaration: the instance type a snapshot
// fills, and the value MST fills it with when the snapshot leaves it out. The
// checker prints a property's MST type as `IOptionalIType<ISimpleType<number>,
// [undefined]>`, so the `types.*` combinators are read off the source and the
// checker is asked only for what they wrap. Undefined when any part of it
// prints as nothing a reader could use.
export interface PropertyType {
  type: string
  defaultValue?: string
}

export function propertyType(
  checker: ts.TypeChecker,
  named: PrintedType[],
  initializer: ts.Expression,
) {
  const read = mstProperty(checker, named, initializer)
  return read && { ...read, type: shortenSignature(read.type, MAX_SIGNATURE) }
}

const DEFAULTED = new Set(['optional', 'stripDefault'])

const WRAPPERS: Record<string, (type: string) => string> = {
  maybe: type => `${type} | undefined`,
  maybeNull: type => `${type} | null`,
  safeReference: type => `${type} | undefined`,
  reference: type => type,
  array: type => `${groupedType(type)}[]`,
  map: type => `Map<string, ${type}>`,
}

function mstProperty(
  checker: ts.TypeChecker,
  named: PrintedType[],
  expression: ts.Expression,
): PropertyType | undefined {
  const node = withoutCasts(expression)
  const combinator = mstCombinator(node)
  const [held, value] = combinator?.call.arguments ?? []
  const defaulted = !!combinator && DEFAULTED.has(combinator.name)
  const wrap = combinator && WRAPPERS[combinator.name]
  const inner =
    held && (defaulted || wrap) ? mstProperty(checker, named, held) : undefined
  return defaulted
    ? inner && { type: inner.type, defaultValue: defaultText(checker, value) }
    : wrap
      ? inner && { type: wrap(inner.type) }
      : isLiteral(node)
        ? {
            type: checker.typeToString(
              checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(node)),
            ),
            defaultValue: node.getText(),
          }
        : combinator?.name === 'frozen'
          ? frozenType(checker, named, combinator.call)
          : (mstConstant(checker, named, node) ??
            readableType(checker, named, createdType(checker, node)))
}

function withoutCasts(node: ts.Expression): ts.Expression {
  return ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isNonNullExpression(node)
    ? withoutCasts(node.expression)
    : node
}

function mstCombinator(node: ts.Expression) {
  const call = ts.isCallExpression(node) ? node : undefined
  const name = call && typesMemberName(call.expression)
  return call && name ? { name, call } : undefined
}

// A primitive written as a property is MST's shorthand for that primitive
// with this default: `bpPerPx: 0`.
function isLiteral(node: ts.Expression) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
  )
}

// A shared MST type held in a constant, read through to the combinators it is
// built from: `id: ElementId` has the default `ElementId` gives it.
function mstConstant(
  checker: ts.TypeChecker,
  named: PrintedType[],
  node: ts.Expression,
) {
  const symbol = ts.isIdentifier(node)
    ? checker.getSymbolAtLocation(node)
    : undefined
  const decl = symbol && aliasTarget(checker, symbol).valueDeclaration
  const init =
    decl &&
    ts.isVariableDeclaration(decl) &&
    !decl.getSourceFile().isDeclarationFile
      ? decl.initializer
      : undefined
  return init && mstCombinator(withoutCasts(init))
    ? mstProperty(checker, named, init)
    : undefined
}

function aliasTarget(checker: ts.TypeChecker, symbol: ts.Symbol) {
  return symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol
}

// `types.frozen<T>(value)` holds a T as written, and defaults to `value`. Its
// MST `Type` is `any` for a T MST cannot prove serializable, as a ReactNode.
function frozenType(
  checker: ts.TypeChecker,
  named: PrintedType[],
  call: ts.CallExpression,
) {
  const [written] = call.typeArguments ?? []
  const [value] = call.arguments
  const read =
    readableType(
      checker,
      named,
      written
        ? checker.getTypeFromTypeNode(written)
        : createdType(checker, call),
    ) ??
    (written && { type: print(written) })
  return read && { ...read, defaultValue: defaultText(checker, value) }
}

// The type an MST type creates: its `Type` member.
function createdType(checker: ts.TypeChecker, node: ts.Expression) {
  const instance = checker.getTypeAtLocation(node).getProperty('Type')
  return instance && checker.getTypeOfSymbolAtLocation(instance, node)
}

const UNRESOLVED = new Set(['any', 'unknown', 'undefined'])

function readableType(
  checker: ts.TypeChecker,
  named: PrintedType[],
  type: ts.Type | undefined,
): PropertyType | undefined {
  const printed =
    type &&
    dropNodeTails(
      nameTypes(
        named,
        checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation),
      ),
    )
  return printed && !UNRESOLVED.has(printed) && !unreadableSignature(printed)
    ? { type: printed }
    : undefined
}

// What MST fills a property with: an arrow's body is computed per instance, a
// function it calls the same way, and a constant reads as its value.
function defaultText(checker: ts.TypeChecker, expression?: ts.Expression) {
  const node = expression && withoutCasts(expression)
  const body =
    node && ts.isArrowFunction(node) && !ts.isBlock(node.body)
      ? node.body
      : node
  const type =
    body && ts.isIdentifier(body) ? checker.getTypeAtLocation(body) : undefined
  return body
    ? type && type.getCallSignatures().length > 0
      ? `${body.getText()}()`
      : type && (type.isStringLiteral() || type.isNumberLiteral())
        ? JSON.stringify(type.value).replace(/^"(.*)"$/, "'$1'")
        : print(body)
    : undefined
}

// A type as the element of an array: `(A | B)[]`, not `A | B[]`.
function groupedType(type: string) {
  return scanGroups(
    type,
    0,
    (i, depth, mark) => mark === 'text' && depth === 0 && type[i] === ' ',
  ) < 0
    ? type
    : `(${type})`
}
