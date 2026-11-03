import * as ts from 'typescript'

import {
  getOwnJSDocText,
  parseTaggedComment,
  startsWithTag,
} from './jsDocTags.ts'
import { MAX_INLINE_CELL_CODE } from './markdown.ts'

// A member's rendered type. `typeToString` truncates past ~340 characters by
// cutting mid-token — leaving unbalanced brackets and half a word, which is
// worse than no type at all (a display's `configuration` printed 340 characters
// of expanded config schema ending in "including c..."). When that happens,
// re-render untruncated and shorten structurally instead, so the type still
// reads as a type.
// A member of an object literal whose type is written elsewhere, as in
// `.volatile((): State => ({ x: undefined }))`, reads as that written type
// rather than its initializer's `undefined`.
// The checker prints an alias's expansion wherever the alias is generic or
// resolves through one: `setViews(views: SnapshotIn<LinearGenomeViewModel>[])`
// printed as `LaunchSnapshotIn<IModelType<…>, …>[]`. Each parameter and return
// type the source writes reads as written where the checker's print of it is
// an MST expansion, or too long for a cell and longer than what the author
// wrote. A union of string literals stays at any length, since it lists the
// values a caller passes, such as `setUnit`'s `"chain" | "read"`. A
// `typeof` query names nothing a reader can look up, so it never replaces a
// print that isn't an expansion.
const writtenPrinter = ts.createPrinter({ removeComments: true })

const MST_EXPANSION =
  /ModelInstanceTypeProps|IModelType|ModelCreationType|ModelSnapshotType|IOptionalIType|ISimpleType|IMSTArray|ExtractCFromProps/

// A whole type, or a function's whole return, that elision collapsed to its
// outer name: `Promise<{…}>`, `Record<…>`.
const COLLAPSED = /(?:^|=> )[\w.]+<(?:…|\{…\})>(?: \| undefined)?$/

// A rendered signature a reader cannot use: one line of it prints an MST
// expansion, or collapses to nothing. `IStateTreeNode` alone is not one, since
// an API can take it (`runLazyAfterAttach<Self extends IStateTreeNode>`).
export function unreadableSignature(sig: string) {
  return sig
    .split('\n')
    .some(line => MST_EXPANSION.test(line) || COLLAPSED.test(line))
}

const LITERAL_UNION =
  /^(?:"(?:[^"\\]|\\.)*"|undefined)(?: \| (?:"(?:[^"\\]|\\.)*"|undefined))+$/

function writtenSignature(
  checker: ts.TypeChecker,
  named: PrintedType[],
  decl: ts.Declaration,
  type: ts.Type,
) {
  // a tuple written across lines prints as `[ A, B ]`
  const print = (node: ts.Node) =>
    writtenPrinter
      .printNode(ts.EmitHint.Unspecified, node, decl.getSourceFile())
      .replace(/\[\s+/g, '[')
      .replace(/\s+\]/g, ']')
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
  const parameters = fn.parameters.map(p => ({
    p,
    type: part(p.type, checker.getTypeAtLocation(p)),
  }))
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

// The function a member or `#api` declaration is: a method, a function, or a
// property or const holding an arrow or function expression.
function writtenFunction(decl: ts.Declaration) {
  if (ts.isMethodDeclaration(decl) || ts.isFunctionDeclaration(decl)) {
    return decl
  }
  const init =
    ts.isPropertyAssignment(decl) || ts.isVariableDeclaration(decl)
      ? decl.initializer
      : undefined
  return init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
    ? init
    : undefined
}

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

export function typeSignature(
  checker: ts.TypeChecker,
  named: PrintedType[],
  symbol: ts.Symbol,
  decl: ts.Declaration,
) {
  const type = declaredType(checker, symbol, decl)
  const written = writtenSignature(checker, named, decl, type)
  if (written) {
    return shortenSignature(written)
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
  const fn = factoryFunction(node)
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
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '"') {
      i = closingQuote(text, i)
    } else if ('<{(['.includes(c)) {
      depth++
    } else if ('>})]'.includes(c) && !(c === '>' && text[i - 1] === '=')) {
      depth--
    } else if (
      depth === 0 &&
      text.startsWith(NODE_TAIL, i) &&
      groupEnd(text, i + NODE_TAIL.length - 1) === text.length
    ) {
      return text.slice(0, i)
    }
  }
  return undefined
}

// The index just past the bracket closing the one at `open`, counting every
// bracket kind; the `>` of a `=>` closes nothing, and a quoted string is
// skipped whole.
function groupEnd(sig: string, open: number) {
  let depth = 0
  for (let i = open; i < sig.length; i++) {
    const c = sig[i]!
    if (c === '"') {
      i = closingQuote(sig, i)
    } else if ('<{(['.includes(c)) {
      depth++
    } else if ('>})]'.includes(c) && !(c === '>' && sig[i - 1] === '=')) {
      depth--
      if (depth === 0) {
        return i + 1
      }
    }
  }
  return -1
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

// Drop the parentheses closing at `close` when what they hold reads the same
// without them, as `(Assembly)[]` does. Anything with a space at its top level
// keeps them: `(A | B)[]`, `(keyof T)[]`, a parameter list.
function unwrapBefore(sig: string, close: number) {
  if (sig[close] !== ')') {
    return sig
  }
  let depth = 0
  let spaced = false
  for (let i = close; i >= 0; i--) {
    const c = sig[i]!
    if (c === '"') {
      spaced = true
      i = sig.lastIndexOf('"', i - 1)
    } else if ('>})]'.includes(c) && !(c === '>' && sig[i - 1] === '=')) {
      depth++
    } else if ('<{(['.includes(c)) {
      depth--
      if (depth === 0) {
        return spaced
          ? sig
          : sig.slice(0, i) + sig.slice(i + 1, close) + sig.slice(close + 1)
      }
    } else if (c === ' ' && depth === 1) {
      spaced = true
    }
  }
  return sig
}

// The marks the checker leaves: a cut at the end, a count where it dropped
// members from the middle of a nested type, and a nested group emptied whole.
const TRUNCATED = /\.\.\.$|\.\.\. \d+ more \.\.\.|<\.\.\.>|\{ \.\.\.; \}/

function shortenSignature(sig: string) {
  return elideSignature(sortUnionMembers(dropNodeTails(sig)))
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

// What a dialog or a fenced block still shows whole. The table cell cuts its
// own preview much shorter (`codeCell`), so this bounds the full text a reader
// opens, not the row.
const MAX_SIGNATURE = 600

// Collapse `<...>` and `{...}` groups from the inside out until the string fits,
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
function closingQuote(sig: string, from: number) {
  let i = from + 1
  while (i < sig.length && sig[i] !== '"') {
    i += sig[i] === '\\' ? 2 : 1
  }
  return Math.min(i, sig.length - 1)
}

const CLOSER: Record<string, string> = { '<': '>', '{': '}' }

function elideGroups(sig: string, max: number) {
  let length = sig.length
  const enclosing: { before: string; open: string }[] = []
  let out = ''
  for (let i = 0; i < sig.length; i++) {
    const c = sig[i]!
    const top = enclosing.at(-1)
    if (c === '"') {
      const end = closingQuote(sig, i)
      out += sig.slice(i, end + 1)
      i = end
    } else if (CLOSER[c]) {
      enclosing.push({ before: out, open: c })
      out = ''
    } else if (
      top &&
      c === CLOSER[top.open] &&
      !(c === '>' && sig[i - 1] === '=')
    ) {
      const inner = out
      enclosing.pop()
      out = top.before
      // `<T, U>(a: T) => U` binds the names its parameters use, as `({ a, b
      // }: T)` names a parameter's fields, and a group that is the whole type
      // leaves nothing to read.
      const isTypeParameterList = c === '>' && sig[i + 1] === '('
      const isBindingPattern = c === '}' && sig[i + 1] === ':'
      const isWholeType = out === '' && i === sig.length - 1
      if (
        length > max &&
        !isTypeParameterList &&
        !isBindingPattern &&
        !isWholeType
      ) {
        length -= inner.length - 1
        out += `${top.open}…${c}`
      } else {
        // once it fits, every enclosing group is emitted whole
        out += `${top.open}${inner}${c}`
      }
    } else {
      out += c
    }
  }
  for (const { before, open } of enclosing.reverse()) {
    out = `${before}${open}${out}`
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
// is that what is printed still reads as a type. Generic arguments and inline
// object types collapse together from the inside out, so `Promise<{ tables:
// {…}; legend: {…} }>` keeps its keys where collapsing every generic first left
// `Promise<…>`. Then a top-level union drops its trailing alternatives. Each
// stage stops as soon as the type fits, so it gives up the least specific
// detail it can.
//
// A type that resists both is left alone. An honest long signature beats a
// mangled short one: truncating this one at a fixed width once ate a function's
// entire return type, leaving it ending mid-parameter.
export function elideSignature(sig: string, max = MAX_SIGNATURE) {
  let out = sig.replace(/\s+/g, ' ')
  if (out.length > max) {
    out = elideGroups(out, max)
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

// The function a #stateModel JSDoc annotates: the declaration itself, or the
// arrow/function initializer of a `const Factory = (...) => {...}`.
export function factoryFunction(node: ts.Node) {
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
