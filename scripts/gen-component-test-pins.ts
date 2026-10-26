// Regenerates (or, with --check, verifies) the `@jbrowse/*` pin lists the
// component-test apps install from. Reads the workspace package.json files
// only, so it runs on a clean checkout without packing anything.
import path from 'node:path'

import { checkOrWriteAll } from '../website/scripts/check-utils.ts'
import { pinnedFiles, readWorkspace } from './componentTestPins.ts'

const root = path.resolve(import.meta.dirname, '..')

checkOrWriteAll(
  pinnedFiles(root, readWorkspace(root)).map(file => ({
    ...file,
    label: path.relative(root, file.path),
  })),
  'run `pnpm gen-component-test-pins`',
)
