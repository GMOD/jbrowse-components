import { SourceMapConsumer } from 'source-map-js'

// Resolves a raw browser stack trace against the source maps of the scripts its
// frames point at. Reference code https://stackoverflow.com/a/77158517/2129219

// source-map-js types originalPositionFor's result as non-nullable, but every
// field comes back null for a frame the map doesn't cover — upstream source-map
// types the same call as NullableMappedPosition
interface NullableMappedPosition {
  source: string | null
  line: number | null
  column: number | null
}

export interface StackFrame {
  name: string
  uri: string
  line: number
  column: number
}

const sourceMappingUrlRe = /\/\/# sourceMappingURL=(.*)/g
// blob: urls (worker scripts) embed a second scheme, so blob: has to be part of
// the match: without it the uri truncates to a script that doesn't exist
const protocolRe = /(?:blob:)?(?:https?|file):\/\//
const digitsRe = /^\d+$/

async function myfetchtext(uri: string) {
  const res = await fetch(uri)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${uri}: ${await res.text()}`)
  }
  return res.text()
}

function sourceMapUrl(script: string, uri: string) {
  // the real annotation is the last one — a bundle can carry the literal
  // earlier in an inlined dependency
  const mapUri = [...script.matchAll(sourceMappingUrlRe)].at(-1)?.[1]?.trim()
  let url: URL | undefined
  if (mapUri) {
    url = new URL(mapUri, uri)
    // vite serves scripts as /foo.js?v=hash and the sibling .map needs the same
    // query; never touch an inline data: map or a map url with its own query
    if (!url.search && url.protocol !== 'data:') {
      url.search = new URL(uri).search
    }
  }
  return url?.href
}

async function loadSourceMap(uri: string) {
  try {
    const mapUrl = sourceMapUrl(await myfetchtext(uri), uri)
    return mapUrl
      ? new SourceMapConsumer(JSON.parse(await myfetchtext(mapUrl)))
      : undefined
  } catch {
    // a frame can point at a script with no map, an unreachable url, or a
    // revoked blob: worker url. Those frames stay raw instead of failing the
    // whole trace
    return undefined
  }
}

// one load attempt per script per session; loadSourceMap never rejects, so a
// miss is cached like a hit rather than refetched for every frame
const sourceMaps = new Map<string, Promise<SourceMapConsumer | undefined>>()

function getSourceMap(uri: string) {
  const existing = sourceMaps.get(uri)
  if (existing) {
    return existing
  } else {
    const map = loadSourceMap(uri)
    sourceMaps.set(uri, map)
    return map
  }
}

// parses a frame line like "  at f (file:///foo.js:12:34)", or firefox's
// "f@file:///foo.js:12:34", into its function name, source uri, line and
// column. undefined when the line has no uri:line:column reference, e.g. the
// message line that chrome puts first
export function parseStackLine(line: string): StackFrame | undefined {
  const protocolMatch = protocolRe.exec(line)
  if (!protocolMatch) {
    return undefined
  }

  const urlStart = protocolMatch.index
  const rest = line.slice(urlStart).replace(/\)$/, '')
  const lastColon = rest.lastIndexOf(':')
  const secondLastColon = rest.lastIndexOf(':', lastColon - 1)
  const lineStr = rest.slice(secondLastColon + 1, lastColon)
  const columnStr = rest.slice(lastColon + 1)

  return secondLastColon > 0 &&
    digitsRe.test(lineStr) &&
    digitsRe.test(columnStr)
    ? {
        name: line
          .slice(0, urlStart)
          .trim()
          .replace(/^at\b\s*/, '')
          .replace(/\s*\($/, '')
          .replace(/@$/, ''),
        uri: rest.slice(0, secondLastColon),
        line: +lineStr,
        column: +columnStr,
      }
    : undefined
}

async function mapStackLine(line: string) {
  const frame = parseStackLine(line)
  const consumer = frame ? await getSourceMap(frame.uri) : undefined
  if (frame && consumer) {
    const pos: NullableMappedPosition = consumer.originalPositionFor({
      line: frame.line,
      // stack traces report 1-based columns, source maps are 0-based
      column: frame.column - 1,
    })
    const { source, line: origLine, column } = pos
    return source !== null && origLine !== null && column !== null
      ? `${source}:${origLine}:${column + 1}${frame.name ? ` (${frame.name})` : ''}`
      : line
  } else {
    return line
  }
}

export async function mapStackTrace(stack: string) {
  return (await Promise.all(stack.split('\n').map(mapStackLine))).join('\n')
}
