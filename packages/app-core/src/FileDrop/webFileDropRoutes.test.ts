import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

import { AssemblyManager } from '../AssemblyManager/index.ts'
import { openDroppedFiles } from './fileDrop.ts'
import { webFileDropRoutes } from './webFileDropRoutes.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

test('a dropped session export replaces the session once the old one is flushed', async () => {
  const session = createTestSession()
  const { rootModel } = getEnv(session).pluginManager
  const nameAtFlush: (string | undefined)[] = []
  const flushSession = jest.fn(async () => {
    nameAtFlush.push(rootModel?.session?.name)
  })
  const file = new File(
    [JSON.stringify({ session: { id: 'old', name: 'Dropped session' } })],
    'session.json',
  )
  await webFileDropRoutes(session, flushSession).openSessionFile(file)
  expect(nameAtFlush).toEqual([session.name])
  expect(rootModel?.session).toMatchObject({ name: 'Dropped session' })
  expect(rootModel?.session?.id).not.toBe('old')
})

test('a JSON file that is not a session export leaves the session alone', async () => {
  const session = createTestSession()
  const { rootModel } = getEnv(session).pluginManager
  const flushSession = jest.fn(async () => {})
  const file = new File(
    [JSON.stringify({ name: 'some-package' })],
    'package.json',
  )
  await expect(
    webFileDropRoutes(session, flushSession).openSessionFile(file),
  ).rejects.toThrow(/not a JBrowse session export/)
  expect(rootModel?.session).toBe(session)
  expect(flushSession).not.toHaveBeenCalled()
})

test('on Web a dropped .jbrowse goes to the tracks route, not the session one', async () => {
  const session = createTestSession()
  const flushSession = jest.fn(async () => {})
  await openDroppedFiles({
    session,
    routes: webFileDropRoutes(session, flushSession),
    files: [new File(['{}'], 'volvox.jbrowse')],
  })
  expect(flushSession).not.toHaveBeenCalled()
  expect(session.snackbarMessages.map(m => m.message)).toEqual([
    'Open a view to add the dropped tracks to first',
  ])
})

test('dropped genome files open the assembly manager with them staged', () => {
  const session = createTestSession()
  const initialFiles: FileLocation[] = [
    { uri: 'https://example.com/hg38.2bit', locationType: 'UriLocation' },
  ]
  webFileDropRoutes(session, async () => {}).openGenomeFiles(initialFiles)
  expect(session.DialogComponent).toBe(AssemblyManager)
  expect(session.DialogProps).toMatchObject({ initialFiles })
})
