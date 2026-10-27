import { createHash } from 'node:crypto'

import { stripComments } from './shader-codegen/parseDirectives.ts'

// Every generated file names the `.slang` it came from and a hash of
// everything slangc read to make it, so a staleness check needs neither slangc
// nor a rebuild: hash the sources again and compare.

export interface StampInput {
  /** Repo-relative, `/`-separated. */
  path: string
  source: string
}

const STAMP_RE = /^\/\/ inputs: ([0-9a-f]{16}) (\S+)$/m

/**
 * The part of a source that reaches an artifact: the `//!` directives, and the
 * code with comments, indentation and blank lines gone. A comment edit to
 * hpmath, which fifty shaders import, regenerates nothing — slangc's output
 * is byte-identical across it. Line breaks stay for the preprocessor's sake,
 * and CRLF folds to LF so a Windows checkout stamps what a Linux one does.
 */
export function significantText(source: string) {
  const text = source.replaceAll('\r\n', '\n')
  const lines = (s: string) =>
    s
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
  return [
    ...lines(text).filter(l => l.startsWith('//!')),
    '\0',
    ...lines(stripComments(text)),
  ].join('\n')
}

export function inputsHash(
  slangVersion: string,
  shader: StampInput,
  imports: readonly StampInput[],
) {
  const hash = createHash('sha256').update(slangVersion)
  for (const file of [
    shader,
    ...imports.toSorted((a, b) => a.path.localeCompare(b.path)),
  ]) {
    hash.update(`\0${file.path}\0${significantText(file.source)}`)
  }
  return hash.digest('hex').slice(0, 16)
}

export const stampLine = (hash: string, slangPath: string) =>
  `// inputs: ${hash} ${slangPath}`

/** Inserts the stamp after the two-line banner every emitter opens with. */
export function stampArtifact(
  contents: string,
  hash: string,
  slangPath: string,
) {
  const lines = contents.split('\n')
  if (
    !lines[0]?.startsWith('// AUTO-GENERATED') ||
    !lines[1]?.startsWith('//')
  ) {
    throw new Error(
      `a generated artifact for ${slangPath} does not open with the banner ` +
        `the stamp goes under`,
    )
  }
  return [
    lines[0],
    lines[1],
    stampLine(hash, slangPath),
    ...lines.slice(2),
  ].join('\n')
}

export function readStamp(contents: string) {
  const m = STAMP_RE.exec(contents.slice(0, 1024))
  return m ? { hash: m[1]!, slangPath: m[2]! } : undefined
}
