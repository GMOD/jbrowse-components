import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { readImports } from './readImports.ts'

let dir: string
let shared: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'read-imports-'))
  shared = path.join(dir, 'shared')
  mkdirSync(shared)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const file = (p: string, source: string) => {
  writeFileSync(p, source)
  return p
}

test('follows `__exported import` the way slangc does', () => {
  file(path.join(shared, 'hpmath.slang'), 'module hpmath;\n')
  file(
    path.join(dir, 'types.slang'),
    'module types;\n__exported import hpmath;\n',
  )
  const shader = 'import types;\n// import ghost;\n'
  expect(
    readImports(file(path.join(dir, 'a.slang'), shader), shader, shared).map(
      m => path.relative(dir, m.path),
    ),
  ).toEqual(['types.slang', path.join('shared', 'hpmath.slang')])
})

test('the shader’s own directory wins over the shared one, and each file is listed once', () => {
  file(path.join(shared, 'colorPack.slang'), 'module colorPack;\n')
  file(path.join(dir, 'colorPack.slang'), 'module colorPack;\n')
  file(path.join(dir, 'b.slang'), 'module b;\nimport colorPack;\n')
  const shader = 'import colorPack;\nimport b;\n'
  expect(
    readImports(file(path.join(dir, 'a.slang'), shader), shader, shared).map(
      m => path.relative(dir, m.path),
    ),
  ).toEqual(['colorPack.slang', 'b.slang'])
})
