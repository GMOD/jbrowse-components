import { liveHref } from './code-base.ts'
import { deriveAddAssembly } from './derive-add-assembly.ts'
import { deriveAddTrack, deriveAddTrackJson } from './derive-add-track.ts'
import { asRecord } from './derive-cli-command.ts'
import { deriveSessionUrl } from './derive-session-url.ts'
import { deriveSetDefaultSession } from './derive-set-default-session.ts'
import { deriveSpecUrl, isLive } from './derive-spec-url.ts'
import { deriveTrackLinks } from './derive-track-url.ts'
import { figureLiveTargets, videoLiveRef } from './figure-live-links.ts'
import { parseAttrs } from './inline-html.ts'
import {
  isAddassembly,
  isAddtrack,
  isSession,
} from './remark-config-cli-tabs.ts'
import { decodeSpecUrl, specConfigUrl } from './spec-recipe/decode.ts'

import type { Code, Html, Parent, Root } from 'mdast'

// The raw markdown served to agents carries, as plain markdown under each
// tagged fence, `<Figure>` and `<Video>`, what a reader of the rendered page
// gets from its tabs and dialogs: the CLI command, the live link and the
// figure's session spec. A spec longer than this many characters is left out,
// its link standing alone.
export const SPEC_LIMIT = 4000

interface Edit {
  start: number
  end: number
  text: string
}

function parseJson(json: string) {
  try {
    const parsed: unknown = JSON.parse(json)
    return { parsed }
  } catch {
    return undefined
  }
}

function fence(lang: string, value: string) {
  const ticks = '`'.repeat(
    Math.max(2, ...[...value.matchAll(/`+/g)].map(m => m[0].length)) + 1,
  )
  return [`${ticks}${lang}`, ...value.split('\n'), ticks]
}

function openLine(url: string, label = '') {
  return ['', `Open in JBrowse${label ? ` (${label})` : ''}: <${url}>`]
}

function cliLines(command: string | null, url?: string) {
  return command === null
    ? []
    : [
        '',
        'CLI:',
        '',
        ...fence('bash', command),
        ...(url ? openLine(url) : []),
      ]
}

function isTagged(node: Code) {
  return isAddtrack(node) || isAddassembly(node) || isSession(node) || isLive(node)
}

function fenceLines(node: Code, parsed: unknown) {
  const config = asRecord(parsed)
  if (isAddtrack(node)) {
    const links = deriveTrackLinks(config, node.meta)
    return cliLines(
      deriveAddTrack(config) ?? deriveAddTrackJson(node.value),
      links && 'webUrl' in links ? links.webUrl : undefined,
    )
  } else if (isAddassembly(node)) {
    return cliLines(deriveAddAssembly(config))
  } else if (isSession(node)) {
    return cliLines(
      deriveSetDefaultSession(config, node.value),
      deriveSessionUrl(config, node.meta),
    )
  } else {
    return openLine(deriveSpecUrl(parsed, node.meta))
  }
}

function figureLines(attrs: Record<string, string>) {
  return figureLiveTargets(attrs).flatMap(({ label, ref }) => {
    const url = liveHref(ref)
    const decoded = decodeSpecUrl(url)
    const spec = decoded && JSON.stringify(decoded.spec, null, 2)
    const config = specConfigUrl(url)
    return [
      ...openLine(url, label),
      ...(spec !== undefined && spec.length <= SPEC_LIMIT
        ? [
            '',
            `Session spec${config ? `, on config <${config}>` : ''}:`,
            '',
            ...fence('json', spec),
          ]
        : []),
    ]
  })
}

function videoLines(attrs: Record<string, string>) {
  const ref = videoLiveRef(attrs.src ?? '')
  return ref === undefined
    ? []
    : ['', `Open the session this video starts in: <${liveHref(ref)}>`]
}

function htmlLines(node: Html) {
  return [...node.value.matchAll(/<(Figure|Video)\s+([\s\S]*?)\s*\/>/g)].flatMap(
    ([, tag, attrList]) => {
      const attrs = parseAttrs(attrList ?? '')
      return tag === 'Figure' ? figureLines(attrs) : videoLines(attrs)
    },
  )
}

// Lines inserted after a block, carrying the block's own indentation (a list
// item's, a blockquote's `>`) so they stay inside its container.
function insertAfter(source: string, start: number, end: number, lines: string[]) {
  const prefix = source
    .slice(source.lastIndexOf('\n', start - 1) + 1, start)
    .replaceAll(/[^>\s]/g, ' ')
  return {
    start: end,
    end,
    text: lines
      .map(line => `\n${line === '' ? prefix.trimEnd() : prefix + line}`)
      .join(''),
  }
}

function fenceEdits(source: string, node: Code, start: number, end: number) {
  const lineEnd = source.indexOf('\n', start)
  const openEnd = lineEnd === -1 || lineEnd > end ? end : lineEnd
  const marker = /^(`{3,}|~{3,})/.exec(source.slice(start, openEnd))?.[1] ?? '```'
  const json = parseJson(node.value)
  const lines = json ? fenceLines(node, json.parsed) : []
  return [
    { start, end: openEnd, text: `${marker}json` },
    ...(lines.length > 0 ? [insertAfter(source, start, end, lines)] : []),
  ]
}

export function withDerivedForms(source: string, tree: Root) {
  const edits: Edit[] = []
  const walk = (parent: Parent) => {
    for (const child of parent.children) {
      const start = child.position?.start.offset
      const end = child.position?.end.offset
      if (start !== undefined && end !== undefined) {
        if (child.type === 'code') {
          if (isTagged(child)) {
            edits.push(...fenceEdits(source, child, start, end))
          }
        } else if (child.type === 'html' || child.type === 'paragraph') {
          const lines =
            child.type === 'html'
              ? htmlLines(child)
              : child.children.flatMap(c => (c.type === 'html' ? htmlLines(c) : []))
          if (lines.length > 0) {
            edits.push(insertAfter(source, start, end, lines))
          }
        } else if ('children' in child) {
          walk(child)
        }
      }
    }
  }
  walk(tree)
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, { start, end, text: replacement }) =>
        text.slice(0, start) + replacement + text.slice(end),
      source,
    )
}
