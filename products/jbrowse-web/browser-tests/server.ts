import path from 'path'
import { fileURLToPath } from 'url'

import { createTestServer } from '@jbrowse/browser-test-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const jbrowseWebRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(__dirname, '../../..')
export const buildPath = path.join(jbrowseWebRoot, 'build')

export function startServer(port: number) {
  return createTestServer(port, { jbrowseWebRoot, repoRoot })
}
