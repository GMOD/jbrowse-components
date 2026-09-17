import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createReExportReach } from './reExportReach.ts'

let dir: string

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'reExportReach-'))
  const files = {
    'barrel.ts': `export const rowsLabel = 'Rows'
export { default as Button } from '@mui/material/Button'
`,
    'rowLabel.ts': `import { rowsLabel } from './barrel.ts'
export function rowLabel(n: number) {
  return rowsLabel + n
}
`,
    'rowMenu.ts': `import AddIcon from '@mui/icons-material/Add'
import { rowsLabel } from './barrel.ts'
export function rowMenu() {
  return [{ label: rowsLabel, icon: AddIcon }]
}
`,
    'saveItem.ts': `import SaveIcon from '@mui/icons-material/Save'
export function saveItem() {
  return { label: 'Save', icon: SaveIcon }
}
`,
  }
  for (const [name, source] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), source)
  }
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

const uiVia = (file: string, name: string) =>
  createReExportReach(() => undefined).uiVia(path.join(dir, file), name)

test('a plain name taken from a barrel that also exports a component is real', () => {
  expect(uiVia('rowLabel.ts', 'rowLabel')).toEqual([])
})

test('a name keeping an icon beside a barrel that renders is UI', () => {
  expect(uiVia('rowMenu.ts', 'rowMenu')).toEqual(['@mui/icons-material/Add'])
})

test('an icon alone does not make a name UI', () => {
  expect(uiVia('saveItem.ts', 'saveItem')).toEqual([])
})
