import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { stripComments } from './parseDirectives.ts'

export interface SlangFile {
  path: string
  source: string
}

// `__exported import` re-exports a module to the importer's importers, and
// slangc follows it like any other import.
const IMPORT_RE = /^\s*(?:__exported\s+)?import\s+(\w+)\s*;/gm

/**
 * Resolves what a shader `import`s, transitively, against the same include
 * path slangc gets — the shader's own directory, then the shared modules in
 * render-core. Each file is read and parsed once per resolver, since a build
 * walks hpmath from every one of its fifty importers.
 *
 * One resolver, because the constant evaluator, `uniformStructOwner`,
 * `resolveTextureFilter` and the inputs stamp all have to see the set slangc
 * compiled: a second walk over the same syntax is how they would come to
 * disagree about what a shader has in scope.
 */
export function createImportResolver(sharedInclude: string) {
  const files = new Map<string, string>()
  const direct = new Map<string, string[]>()
  const read = (p: string) => {
    let source = files.get(p)
    if (source === undefined) {
      source = readFileSync(p, 'utf8')
      files.set(p, source)
    }
    return source
  }
  const directImports = (slangPath: string, source: string) => {
    let found = direct.get(slangPath)
    if (!found) {
      const dir = path.dirname(slangPath)
      found = [...stripComments(source).matchAll(IMPORT_RE)].flatMap(m => {
        const hit = [dir, sharedInclude]
          .map(d => path.join(d, `${m[1]!}.slang`))
          .find(p => existsSync(p))
        return hit ? [hit] : []
      })
      direct.set(slangPath, found)
    }
    return found
  }
  return (slangPath: string, source: string): SlangFile[] => {
    const seen = new Set<string>()
    const out: SlangFile[] = []
    const visit = (p: string, text: string) => {
      for (const imported of directImports(p, text)) {
        if (!seen.has(imported)) {
          seen.add(imported)
          const importedSource = read(imported)
          out.push({ path: imported, source: importedSource })
          visit(imported, importedSource)
        }
      }
    }
    visit(slangPath, source)
    return out
  }
}

export function readImports(
  slangPath: string,
  source: string,
  sharedInclude: string,
) {
  return createImportResolver(sharedInclude)(slangPath, source)
}
