import * as ts from 'typescript'

export type TagType = (typeof TAG_TYPES)[number]

export const TAG_TYPES = [
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

/**
 * True when the JSDoc tag `#name` heads a line of `text` (`* #category general`)
 * and matches as a whole token, so `#getter` does not match `#getterById`. A tag
 * mentioned inside prose carries nothing. Every scan asks this one question.
 */
export function startsWithTag(text: string, name: string) {
  return new RegExp(`^\\s*\\*?\\s*#${name}(?![A-Za-z0-9_])`, 'm').test(text)
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
export function getOwnJSDocText(node: ts.Node): string {
  return jsDocText(ts.isVariableDeclaration(node) ? node.parent.parent : node)
}

export function getOwnJSDocTagText(node: ts.Node): string {
  return jsDocTagText(
    ts.isVariableDeclaration(node) ? node.parent.parent : node,
  )
}

export interface Example {
  label: string
  content: string
}

// Tags a marker-table generator reads off a #config/#stateModel comment, whose
// line is no part of the page's prose. `#crossCuttingMixin` is not one: its
// text is the mixin's summary and opens the page.
const TABLE_TAGS = ['fileFormat', 'displayFoundation', 'displayFoundationDef']

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
  // A #gotcha runs to the next tag or blank line, and its own line breaks are
  // comment wrapping, not markdown.
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
    } else if (TABLE_TAGS.some(t => startsWithTag(line, t))) {
      endGotcha()
    } else if (startsWithTag(line, 'crossCuttingMixin')) {
      endGotcha()
      docs.push(line.replace(/#crossCuttingMixin\s*/, ''))
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
    const parts = m[1]!.split('|').map(s => s.trim())
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
