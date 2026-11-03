import fs from 'fs'
import path from 'path'

import * as ts from 'typescript'

import { isTsSource, repoFiles } from '../check-utils.ts'

// Parse a source file syntactically (no type checker / program), for the
// marker-block generators (color/jexl) that only read JSDoc text and
// string-literal initializers — keeping them independent of the file's heavy
// runtime imports (e.g. theme.ts's MUI). `text` lets a caller that already read
// the file hand it over instead of paying a second read.
export function parseSourceFileSyntactic(file: string, text?: string) {
  return ts.createSourceFile(
    file,
    text ?? fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
}

// Read a file from the getAllFiles() list, or undefined if it is gone. That list
// is a snapshot, and a run spends ~15s in its TypeScript pass before the
// text-scanning generators walk it — long enough for a scratch file another
// process created and removed to still be on the list. `getAllFiles` already
// drops what `git ls-files` reports but the worktree lacks; this covers the file
// that disappears after that check, which otherwise takes the whole run down at
// the last step, with every page already written and the format sweep never
// reached. Only ENOENT is swallowed — any other read error is a real problem.
function readSourceIfPresent(file: string) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw e
  }
}

// The sources the text-scanning generators read tags out of, read once.
//
// Five of them used to walk the tree themselves and read every file again — five full walks and five full reads per run, and three
// different answers about what "the source tree" is. Two scanned
// `packages`+`plugins` and two `packages`+`plugins`+`products`, so the same tag
// written in a product was documented by one generator and silently ignored by
// the other; and a filesystem walk sees gitignored files, which the
// program-driven half of the pipeline (`getAllFiles`) does not.
//
// So the list comes from `getAllFiles` now, the same list the TypeScript
// program is built over, narrowed to what a walk used to yield: no test
// files (a `#extensionPoint` in a fixture is not an extension point) and no
// `.js`, which `getAllFiles` includes for the program's benefit and which
// carries no tags.
export interface SourceCorpus {
  files: string[]
  read: (file: string) => string
  // The file's syntax tree. A caller holding a TypeScript program hands its
  // already-parsed sources to `sourceCorpus`, since parsing the corpus a second
  // time to answer a syntactic question cost a `gendocs` run 2.7s.
  parse: (file: string) => ts.SourceFile
}

// The corpus's own file list, which `createDocProgram`'s roots are also built
// from — so a program built beside a corpus has parsed exactly these.
export function corpusFiles(files: string[]) {
  return files.filter(f => isTsSource(f.split('/').at(-1)!))
}

export function sourceCorpus(
  files: string[],
  parsed: readonly ts.SourceFile[] = [],
): SourceCorpus {
  const texts = new Map<string, string>()
  const trees = new Map(parsed.map(sf => [path.resolve(sf.fileName), sf]))
  const read = (file: string) => {
    let text = texts.get(file)
    if (text === undefined) {
      text = readSourceIfPresent(file) ?? ''
      texts.set(file, text)
    }
    return text
  }
  return {
    files: corpusFiles(files),
    read,
    parse(file) {
      let tree = trees.get(path.resolve(file))
      if (tree === undefined) {
        tree = parseSourceFileSyntactic(file, read(file))
        trees.set(path.resolve(file), tree)
      }
      return tree
    },
  }
}

// Every source file the generators document, from `repoFiles`, which says
// which untracked files count. Leaving a new file out would hide more than its
// tags: the TypeScript program can't resolve imports of it either, so every
// signature that flows through it silently degrades to `any`.
//
// The `plugins` alternative is deliberately unanchored: it also matches
// `example-plugins/`, the worked examples backing the developer guides, whose
// LinearScoreDisplay config and model are documented pages.
export async function getAllFiles() {
  return repoFiles().filter(f =>
    /(plugins|products|packages).*\.(t|j)sx?$/.test(f),
  )
}
