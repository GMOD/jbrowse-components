/**
 * The half of the contract channel a plugin author actually sees.
 *
 * Each check is pinned where it lives; what is here is the only thing between
 * one of them and somebody else's production build — the session notice, and
 * what it has to say for itself to a reader who did not turn it on. So these
 * run against a production module scope, which is the only state where the
 * arming paths do anything.
 */
import { destroy, types } from '@jbrowse/mobx-state-tree'

import type { NotificationLevel } from '@jbrowse/core/util/types'

async function inProductionBuild() {
  const wasNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  jest.resetModules()
  const channel = await import('@jbrowse/render-core/contractReports')
  const { applyDeveloperMode } = await import('./developerMode.ts')
  process.env.NODE_ENV = wasNodeEnv
  return { ...channel, applyDeveloperMode }
}

function makeHost(preferences: Record<string, unknown> = {}) {
  return types
    .model('DeveloperModeHost', {})
    .volatile(() => ({
      notices: [] as { message: string; level?: NotificationLevel }[],
    }))
    .views(() => ({
      getPreference(key: string) {
        return preferences[key]
      },
    }))
    .actions(self => ({
      notify(message: string, level?: NotificationLevel) {
        self.notices.push({ message, level })
      },
    }))
    .create()
}

test('a violation reaches the session as a warning that explains itself', async () => {
  const { applyDeveloperMode, enableContractReports, reportContractViolation } =
    await inProductionBuild()
  const session = makeHost()
  applyDeveloperMode(session)
  enableContractReports('a plugin is served from this machine')

  reportContractViolation('display', 'a display attached twice')
  takeContractReports()
  await Promise.resolve()

  const [notice, ...rest] = session.notices
  expect(rest).toEqual([])
  expect(notice?.level).toBe('warning')
  expect(notice?.message).toContain('a display attached twice')
  expect(notice?.message).toContain('not in your data')
  expect(notice?.message).toContain('a plugin is served from this machine')
  expect(notice?.message).toContain('jbrowseDeveloperMode')
})

// the notice is written after the reaction, fetch handler or upload that found
// the violation has unwound: `notify` writes observables, and a diagnostic that
// throws where it is read is worse than the bug it describes
test('the notice is not written inside whatever found the violation', async () => {
  const { applyDeveloperMode, enableContractReports, reportContractViolation } =
    await inProductionBuild()
  const session = makeHost()
  applyDeveloperMode(session)
  enableContractReports('a plugin is served from this machine')

  reportContractViolation('figure', 'two figures of one view')
  takeContractReports()

  expect(session.notices).toEqual([])
})

test('a session destroyed before its notice lands writes nothing', async () => {
  const { applyDeveloperMode, enableContractReports, reportContractViolation } =
    await inProductionBuild()
  const session = makeHost()
  applyDeveloperMode(session)
  enableContractReports('a plugin is served from this machine')

  reportContractViolation('session', 'a track config outlives its assembly')
  destroy(session)
  takeContractReports()
  await Promise.resolve()

  expect(session.notices).toEqual([])
})

test('a site can ask for the notices in its own config', async () => {
  const { applyDeveloperMode, reportContractViolation } =
    await inProductionBuild()
  const session = makeHost({ developerMode: true })
  applyDeveloperMode(session)

  reportContractViolation('display', 'a dead Retry button')
  takeContractReports()
  await Promise.resolve()

  expect(session.notices[0]?.message).toContain(
    'this site sets configuration.preferences.developerMode',
  )
})

test('a violation found before the session exists still reaches it', async () => {
  const { applyDeveloperMode, enableContractReports, reportContractViolation } =
    await inProductionBuild()

  // MST attaches a display before the session containing it, so an attach-time
  // check always finds its violation before anything can show it
  enableContractReports('a plugin is served from this machine')
  reportContractViolation('display', 'a display attached twice')
  const session = makeHost()
  applyDeveloperMode(session)
  takeContractReports()
  await Promise.resolve()

  expect(session.notices[0]?.message).toContain('a display attached twice')
})
