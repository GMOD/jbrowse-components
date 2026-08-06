/// <reference types="jest" />

/**
 * `desktopAutogenNames` is a hand-maintained copy of a list that lives in
 * another product, and until this test the only thing holding the two together
 * was a comment asking the next person to remember.
 *
 * Drift is silent in the direction it will actually happen. Add a figure to the
 * desktop generator and forget this list, and the review UI labels the new
 * figure "manual" — which specifically means "no generator can reproduce this,
 * re-shoot it by hand". A reviewer denying it is then told to do by hand what
 * `pnpm --filter jbrowse-desktop screenshots` would have done. Nothing errors,
 * and the figure looks fine.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { desktopAutogenNames } from './desktop-figures.ts'

// The generator's own list. Read as text rather than imported: screenshots.ts
// pulls in selenium-webdriver and the electron harness at module scope, so
// importing it from a website test would start building a browser session to
// answer a question about ten strings. FIGURES is module-private there anyway.
const generator = join(
  __dirname,
  '..',
  '..',
  'products',
  'jbrowse-desktop',
  'test',
  'screenshots.ts',
)

function generatorFigureNames(): string[] {
  const src = readFileSync(generator, 'utf8')
  const block = /^const FIGURES = \[$([\s\S]*?)^\]$/m.exec(src)
  if (!block) {
    // The regex is the fragile part, so it fails loudly rather than returning
    // an empty list — which would make every assertion below vacuous exactly
    // when the file it is guarding got restructured.
    throw new Error(`could not find the FIGURES list in ${generator}`)
  }
  return [...block[1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!)
}

test('the review UI knows every figure the desktop generator produces', () => {
  const fromGenerator = generatorFigureNames()
  expect(fromGenerator.length).toBeGreaterThan(0)
  // its list carries the extension, the review UI keys on names
  expect(fromGenerator.every(n => n.endsWith('.png'))).toBe(true)
  expect([...desktopAutogenNames].sort()).toStrictEqual(
    fromGenerator.map(n => n.replace(/\.png$/, '')).sort(),
  )
})

test('the stacked step figures are among them', () => {
  // PROCEDURES composes these from several shots, and they are committed the
  // same way as any other capture — the trap being that they never appear in a
  // `capture(driver, '...')` call, so a grep for those misses them.
  for (const name of [
    'desktop-open-genome-steps',
    'desktop-available-genomes-steps',
    'desktop-add-track-steps',
  ]) {
    expect(desktopAutogenNames.has(name)).toBe(true)
  }
})
