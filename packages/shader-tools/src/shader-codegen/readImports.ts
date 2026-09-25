import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { stripComments } from './parseDirectives.ts'

export interface SlangFile {
  path: string
  source: string
}

/**
 * Every module a shader `import`s, transitively, resolved against the same
 * include path slangc gets — the shader's own directory, then the shared
 * modules in render-core.
 *
 * One resolver, because the constant evaluator, `uniformStructOwner` and
 * `resolveTextureFilter` all have to see the same set slangc compiled: a second
 * walk over the same syntax is how the two would come to disagree about what a
 * shader has in scope.
 */
export function readImports(
  slangPath: string,
  source: string,
  sharedInclude: string,
  seen = new Set<string>(),
): SlangFile[] {
  const dir = path.dirname(slangPath)
  const code = stripComments(source)
  const out: SlangFile[] = []
  for (const m of code.matchAll(/^\s*import\s+(\w+)\s*;/gm)) {
    const found = [dir, sharedInclude]
      .map(d => path.join(d, `${m[1]!}.slang`))
      .find(p => existsSync(p))
    if (!found || seen.has(found)) {
      continue
    }
    seen.add(found)
    const imported = readFileSync(found, 'utf8')
    out.push(
      { path: found, source: imported },
      ...readImports(found, imported, sharedInclude, seen),
    )
  }
  return out
}
