import fs from 'fs'
import os from 'os'
import path from 'path'

import { createDocProgram, extractWithComment } from './util.ts'

// A member's type reads as the source writes it only where the checker's print
// is worse. Driven through a real `ts.Program`: what is under test is the
// checker losing an alias, which a stand-in could not reproduce.

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-written-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function signatureOf(source: string, name: string) {
  const file = path.join(dir, 'api.ts')
  fs.writeFileSync(file, source)
  let signature: string | undefined
  extractWithComment(
    createDocProgram([file]),
    node => {
      if (node.name === name) {
        signature = node.signature
      }
    },
    () => {},
  )
  return signature
}

const UNWRAP = `
type Unwrap<T> = T extends { v: infer U } ? U : never
export type Settings = Unwrap<{
  v: { featureHeight: number; maxHeight: number; displayMode: string; showLabels: boolean }
}>
`

test('a long expansion reads as the alias the source wrote', () => {
  expect(
    signatureOf(
      `${UNWRAP}
/** #api test */
export function apply(settings: Settings) {}
`,
      'apply',
    ),
  ).toBe('(settings: Settings) => void')
})

test('a union of string literals keeps its values', () => {
  expect(
    signatureOf(
      `export interface Config {
  scheme: 'viridis' | 'magma' | 'inferno' | 'cividis' | 'juicebox' | 'reds'
}
/** #api test */
export function setScheme(scheme: Config['scheme']) {}
`,
      'setScheme',
    ),
  ).toBe(
    '(scheme: "cividis" | "inferno" | "juicebox" | "magma" | "reds" | "viridis") => void',
  )
})

test('a typeof query does not replace the expansion it names', () => {
  expect(
    signatureOf(
      `function make() {
  return { featureHeight: 1, maxHeight: 2, displayMode: 'normal', showLabels: true }
}
/** #api test */
export function apply(settings: ReturnType<typeof make>) {}
`,
      'apply',
    ),
  ).toBe(
    '(settings: { featureHeight: number; maxHeight: number; displayMode: string; showLabels: boolean; }) => void',
  )
})

test('a destructured parameter reads without its defaults', () => {
  expect(
    signatureOf(
      `${UNWRAP}
/** #api test */
export function apply({ featureHeight = 10, maxHeight }: Settings) {}
`,
      'apply',
    ),
  ).toBe('({ featureHeight, maxHeight }: Settings) => void')
})
