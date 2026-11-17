import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

import { AssemblyManager } from '../AssemblyManager/index.ts'
import { webFileDropRoutes } from './webFileDropRoutes.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

test('a dropped session export replaces the session', async () => {
  const session = createTestSession()
  const { rootModel } = getEnv(session).pluginManager
  const file = new File(
    [JSON.stringify({ session: { id: 'old', name: 'Dropped session' } })],
    'session.json',
  )
  await webFileDropRoutes(session).openSessionFile(file)
  expect(rootModel?.session).toMatchObject({ name: 'Dropped session' })
  expect(rootModel?.session?.id).not.toBe('old')
})

test('a desktop .jbrowse, a whole config, is not taken for a session export', () => {
  expect(webFileDropRoutes(createTestSession()).sessionFileExtensions).toEqual([
    '.json',
  ])
})

test('dropped genome files open the assembly manager with them staged', () => {
  const session = createTestSession()
  const initialFiles: FileLocation[] = [
    { uri: 'https://example.com/hg38.2bit', locationType: 'UriLocation' },
  ]
  webFileDropRoutes(session).openGenomeFiles(initialFiles)
  expect(session.DialogComponent).toBe(AssemblyManager)
  expect(session.DialogProps).toMatchObject({ initialFiles })
})
