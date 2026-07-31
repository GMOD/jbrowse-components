// Resolve minified v8 call frames back to source through build/static/js/*.js.map.
// Shared by analyze-trace.ts (CPU sampler) and profile-allocations.ts (sampling
// heap profiler) — both receive frames in the same shape.
//
// The maps MUST come from the build that produced the profile: chunk filenames
// carry a content hash, so a rebuild between capture and analysis makes every
// lookup miss and every frame silently falls back to its minified name (`r`,
// `(anon)`). A stale trace once showed ~264 ms of 722 ms unresolved with the
// real hotspot buried inside it. `unresolved()` reports how much landed in the
// fallback so a caller can refuse to interpret a bad run.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { buildPath } from './server.ts'

const require = createRequire(import.meta.url)
const smPath = require
  .resolve('webpack')
  .replace(/webpack@.*/, 'source-map@0.6.1/node_modules/source-map')
const { SourceMapConsumer } = require(smPath)

export interface Frame {
  functionName: string
  url: string
  lineNumber: number
  columnNumber: number
}

export function createFrameResolver() {
  const consumers = new Map<string, any>()
  let resolved = 0
  let unresolved = 0

  async function consumerFor(url: string) {
    const base = (url || '').split('/').pop() || ''
    if (!base.endsWith('.js')) {
      return null
    }
    if (consumers.has(base)) {
      return consumers.get(base)
    }
    const mapFile = path.join(buildPath, 'static', 'js', `${base}.map`)
    const c = fs.existsSync(mapFile)
      ? await new SourceMapConsumer(
          JSON.parse(fs.readFileSync(mapFile, 'utf8')),
        )
      : null
    consumers.set(base, c)
    return c
  }

  return {
    async resolve(f: Frame) {
      const c = await consumerFor(f.url)
      const fallback = `${f.functionName || '(anon)'}  [${((f.url || '').split('/').pop() || 'native').slice(0, 20)}]`
      const pos = c?.originalPositionFor({
        line: f.lineNumber + 1,
        column: f.columnNumber,
      })
      if (!pos?.source) {
        // Only a frame that came from a bundle chunk counts as a miss. V8's
        // builtin frames (`join`, `bind`, empty url) have no map by
        // construction and would otherwise pin the miss rate high enough to
        // fire the stale-source-map warning on a perfectly good run.
        if ((f.url || '').endsWith('.js')) {
          unresolved++
        }
        return fallback
      }
      resolved++
      const src = pos.source
        .replace(/.*\/node_modules\//, '~/')
        .replace(/^webpack:\/\/[^/]*\//, '')
      return `${pos.name || f.functionName || '(anon)'}  [${src}:${pos.line}]`
    },
    counts() {
      return { resolved, unresolved }
    },
  }
}
