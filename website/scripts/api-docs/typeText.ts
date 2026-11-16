// Printed types as text: walking their brackets, shortening them structurally,
// and tidying what the checker prints. Nothing here needs the checker, so a
// table cell can shorten a type without loading the program.

type Mark = 'enter' | 'exit' | 'quote' | 'text'

const OPENERS = '<{(['
const CLOSERS = '>})]'

export function closingQuote(sig: string, from: number) {
  let i = from + 1
  while (i < sig.length && sig[i] !== '"') {
    i += sig[i] === '\\' ? 2 : 1
  }
  return Math.min(i, sig.length - 1)
}

// Walks `sig` from `from` (backwards when `step` is -1), telling `visit` what
// each character is and how deep in brackets it sits. A bracket shares its
// depth with the text around its group. A quoted string is visited once, at the
// quote the walk meets first, and skipped whole; the `>` of a `=>` is text.
// Returns the index `visit` first returns true at, or -1.
export function scanGroups(
  sig: string,
  from: number,
  visit: (i: number, depth: number, mark: Mark) => boolean,
  step: 1 | -1 = 1,
) {
  const [enters, exits] = step === 1 ? [OPENERS, CLOSERS] : [CLOSERS, OPENERS]
  let depth = 0
  let found = -1
  for (let i = from; found < 0 && i >= 0 && i < sig.length; i += step) {
    const c = sig.charAt(i)
    const mark: Mark =
      c === '"'
        ? 'quote'
        : c === '>' && sig[i - 1] === '='
          ? 'text'
          : enters.includes(c)
            ? 'enter'
            : exits.includes(c)
              ? 'exit'
              : 'text'
    if (mark === 'exit') {
      depth--
    }
    if (visit(i, depth, mark)) {
      found = i
    } else if (mark === 'enter') {
      depth++
    } else if (mark === 'quote') {
      i = step === 1 ? closingQuote(sig, i) : sig.lastIndexOf('"', i - 1)
    }
  }
  return found
}

// The index just past the bracket closing the one at `open`, or -1.
export function groupEnd(sig: string, open: number) {
  const close = scanGroups(
    sig,
    open,
    (_, depth, mark) => mark === 'exit' && depth === 0,
  )
  return close < 0 ? -1 : close + 1
}

// Drop the parentheses closing at `close` when what they hold reads the same
// without them, as `(Assembly)[]` does. Anything with a space at its top level
// keeps them: `(A | B)[]`, `(keyof T)[]`, a parameter list.
export function unwrapBefore(sig: string, close: number) {
  let spaced = false
  const open =
    sig[close] === ')'
      ? scanGroups(
          sig,
          close,
          (i, depth, mark) => {
            spaced ||=
              mark === 'quote' ||
              (mark === 'text' && depth === 1 && sig[i] === ' ')
            return mark === 'exit' && depth === 0
          },
          -1,
        )
      : -1
  return open < 0 || spaced
    ? sig
    : sig.slice(0, open) + sig.slice(open + 1, close) + sig.slice(close + 1)
}

// Where `sig` splits at its top level on `separator`, ignoring any inside
// brackets or quotes: a union of four object types splits into four, a
// function type whose parameter is `boolean | undefined` stays whole.
function topLevelSplit(sig: string, separator: string) {
  const parts: string[] = []
  let start = 0
  scanGroups(sig, 0, (i, depth, mark) => {
    if (mark === 'text' && depth === 0 && sig.startsWith(separator, i)) {
      parts.push(sig.slice(start, i).trim())
      start = i + separator.length
    }
    return false
  })
  parts.push(sig.slice(start).trim())
  return parts
}

// What a dialog or a fenced block still shows whole. The table cell cuts its
// own preview much shorter (`previewType`), so this bounds the full text a
// reader opens, not the row.
export const MAX_SIGNATURE = 600

const CLOSER: Record<string, string> = { '<': '>', '{': '}' }

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
// An `open` that never closes is not a group: its text goes back verbatim.
// With `keepLeading`, an object keeps the members ahead of the ones it has to
// drop: `{ key: string; x: number; … }`.
function elideGroups(sig: string, max: number, keepLeading: boolean) {
  let length = sig.length
  const enclosing: { before: string; open: string }[] = []
  let out = ''
  scanGroups(sig, 0, (i, _, mark) => {
    const c = sig.charAt(i)
    const top = enclosing.at(-1)
    if (mark === 'quote') {
      out += sig.slice(i, closingQuote(sig, i) + 1)
    } else if (mark === 'enter' && CLOSER[c]) {
      enclosing.push({ before: out, open: c })
      out = ''
    } else if (mark === 'exit' && top && c === CLOSER[top.open]) {
      const inner = out
      enclosing.pop()
      out = top.before
      // `<T, U>(a: T) => U` binds the names its parameters use, as `({ a, b
      // }: T)` names a parameter's fields, and a group that is the whole type
      // leaves nothing to read.
      const isTypeParameterList = c === '>' && sig[i + 1] === '('
      const isBindingPattern = c === '}' && sig[i + 1] === ':'
      const isWholeType = out === '' && i === sig.length - 1
      const leading =
        keepLeading && c === '}' && length > max
          ? leadingMembers(inner, length - max)
          : undefined
      if (
        length > max &&
        !isTypeParameterList &&
        !isBindingPattern &&
        (!isWholeType || leading)
      ) {
        const collapsed = leading ?? '…'
        length -= inner.length - collapsed.length
        out += `${top.open}${collapsed}${c}`
      } else {
        // once it fits, every enclosing group is emitted whole
        out += `${top.open}${inner}${c}`
      }
    } else {
      out += c
    }
    return false
  })
  for (const { before, open } of enclosing.reverse()) {
    out = `${before}${open}${out}`
  }
  return out
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
export function elideSignature(
  sig: string,
  max = MAX_SIGNATURE,
  keepLeading = false,
) {
  let out = sig.replace(/\s+/g, ' ')
  if (out.length > max) {
    out = elideGroups(out, max, keepLeading)
  }
  if (out.length > max) {
    const parts = topLevelSplit(out, '|')
    const kept = parts.filter(
      (_, i) => i === 0 || parts.slice(0, i + 1).join(' | ').length + 4 <= max,
    )
    out = kept.length < parts.length ? `${kept.join(' | ')} | …` : out
  }
  return out
}

// An object's text with as few of its trailing members dropped as frees
// `excess` characters; undefined when that would leave none.
function leadingMembers(inner: string, excess: number) {
  const separator = topLevelSplit(inner, ';').length > 1 ? ';' : ','
  const members = topLevelSplit(inner, separator).filter(Boolean)
  const kept = (count: number) =>
    ` ${[...members.slice(0, count), '…'].join(`${separator} `)} `
  const count = members
    .map((_, i) => members.length - 1 - i)
    .find(n => n > 0 && inner.length - kept(n).length >= excess)
  return count === undefined ? undefined : kept(count)
}

// A function type's parameter list and return type, split at its top-level
// `=>`; undefined for anything else.
export function functionParts(sig: string) {
  const arrow = scanGroups(
    sig,
    0,
    (i, depth, mark) =>
      mark === 'text' && depth === 0 && sig.startsWith('=>', i),
  )
  return arrow > 0 && /^[<(]/.test(sig)
    ? {
        parameters: sig.slice(0, arrow).trim(),
        returns: sig.slice(arrow + 2).trim(),
      }
    : undefined
}

// The names of `<T>(a: A, b?: B)`: `a`, `b?`.
function parameterNames(parameters: string) {
  const open = parameters.startsWith('<') ? groupEnd(parameters, 0) : 0
  const list = parameters.slice(open + 1, groupEnd(parameters, open) - 1)
  return list.trim()
    ? topLevelSplit(list, ',').map(p => topLevelSplit(p, ':')[0] ?? p)
    : []
}

// A function as its parameters' names and its return, dropping trailing
// names until it fits: `(trackId, initialSnapshot?, …) => void`.
function namedFunction(
  { parameters, returns }: { parameters: string; returns: string },
  max: number,
) {
  const names = parameterNames(parameters)
  const forms = names.map((_, i) => {
    const kept = names.length - i
    const head = `(${[...names.slice(0, kept), ...(i ? ['…'] : [])].join(', ')}) => `
    return `${head}${elideSignature(returns, max - head.length, true)}`
  })
  return forms.find(form => form.length <= max) ?? forms[0]
}

// The longest head of `code` within `max` that stops between tokens, never
// inside a name.
function cutAtToken(code: string, max: number) {
  const head = code.slice(0, max - 1)
  const whole = /[\w$]/.test(code[max - 1] ?? '')
    ? head.replace(/[\w$.]+$/, '')
    : head
  return `${(whole || head).trimEnd()}…`
}

// A preview of `code` that fits `max` characters and still reads as code:
// generics and objects collapse first, then a function keeps only its
// parameters' names, and only then is it cut, between two tokens.
export function previewType(code: string, max: number) {
  const flat = code.replace(/\s+/g, ' ').trim()
  const elided = flat.length > max ? elideSignature(flat, max, true) : flat
  const fn = elided.length > max ? functionParts(elided) : undefined
  const named = (fn && namedFunction(fn, max)) ?? elided
  return named.length > max ? cutAtToken(named, max) : named
}

// What the checker prints for `ReactNode` once it has been awaited.
const AWAITED_REACT_NODE =
  'ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | AwaitedReactNode'

function startsOf(sig: string, at: (i: number, depth: number) => boolean) {
  const starts: number[] = []
  scanGroups(sig, 0, (i, depth, mark) => {
    if (mark === 'text' && at(i, depth)) {
      starts.push(i)
    }
    return false
  })
  return starts.reverse()
}

// `?: T | undefined` says `undefined` twice. Not after a function type's
// arrow, where the `| undefined` belongs to its return.
function dropOptionalUndefined(sig: string) {
  return startsOf(sig, i => sig.startsWith('?: ', i)).reduce((out, at) => {
    const start = at + 3
    const stop = scanGroups(
      out,
      start,
      (i, depth, mark) =>
        (mark === 'exit' && depth < 0) ||
        (mark === 'text' && depth === 0 && (out[i] === ',' || out[i] === ';')),
    )
    const type = out.slice(start, stop < 0 ? out.length : stop).trimEnd()
    const defined = type.slice(0, -' | undefined'.length)
    const bare =
      defined.startsWith('(') && groupEnd(defined, 0) === defined.length
        ? defined.slice(1, -1)
        : defined
    return type.endsWith(' | undefined') && !functionParts(type)
      ? out.slice(0, start) + bare + out.slice(start + type.length)
      : out
  }, sig)
}

// `NoInfer<T>` steers inference at a call site and reads as `T`.
function unwrapNoInfer(sig: string) {
  return startsOf(
    sig,
    i => sig.startsWith('NoInfer<', i) && !/[\w$]/.test(sig[i - 1] ?? ''),
  ).reduce((out, at) => {
    const open = at + 'NoInfer'.length
    const close = groupEnd(out, open)
    return close < 0
      ? out
      : out.slice(0, at) + out.slice(open + 1, close - 1) + out.slice(close)
  }, sig)
}

// Spellings the checker prints that say less than the type they stand for.
export function tidyType(sig: string) {
  return dropOptionalUndefined(
    unwrapNoInfer(sig.replaceAll(AWAITED_REACT_NODE, 'ReactNode')),
  )
}
