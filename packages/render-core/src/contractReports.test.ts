/**
 * The channel every `[jbrowse <family> contract]` check reports through.
 *
 * What these pin is the half the checks themselves cannot: out of tree the
 * checks run inside somebody else's production build, where nothing is stripped
 * and nothing is listening, so a violation has to survive being found before
 * anything can show it — MST attaches a display before the session that would.
 *
 * Each case takes the module fresh, because what is under test IS its module
 * state: a channel armed once stays armed, which is the whole point of it.
 */
import type { ContractReport } from './contractReports.ts'

async function channel(nodeEnv: 'development' | 'production') {
  const wasNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = nodeEnv
  jest.resetModules()
  const mod = await import('./contractReports.ts')
  process.env.NODE_ENV = wasNodeEnv
  return mod
}

test('a development build is armed with nothing asked of it', async () => {
  const mod = await channel('development')

  expect(mod.contractReportsOn()).toBe(true)
  mod.reportContractViolation('display', 'a development build reports at once')

  expect(takeContractReports()).toEqual([
    '[jbrowse display contract] a development build reports at once',
  ])
})

test('a sink is handed the report and what armed the channel', async () => {
  const mod = await channel('development')
  const seen: ContractReport[] = []
  const dispose = mod.setContractReportSink(report => {
    seen.push(report)
  })

  mod.reportContractViolation('figure', 'two figures of one view')
  dispose()
  mod.reportContractViolation('figure', 'after the sink left')

  takeContractReports()
  expect(seen).toEqual([
    {
      family: 'figure',
      message: 'two figures of one view',
      armedBy: 'this is a development build',
    },
  ])
})

test('a disposer leaves alone a sink that replaced its own', async () => {
  const mod = await channel('development')
  const first: string[] = []
  const second: string[] = []
  const disposeFirst = mod.setContractReportSink(r => first.push(r.message))
  mod.setContractReportSink(r => second.push(r.message))

  // the session-swap order: the outgoing session is torn down after the
  // incoming one has installed its own sink
  disposeFirst()
  mod.reportContractViolation('session', 'a track config outlives its assembly')

  takeContractReports()
  expect(first).toEqual([])
  expect(second).toEqual(['a track config outlives its assembly'])
})

test('a production build reads the developer flag out of localStorage', async () => {
  localStorage.setItem('jbrowseDeveloperMode', '1')
  try {
    const mod = await channel('production')

    expect(mod.contractReportsOn()).toBe(true)
    mod.reportContractViolation('display', 'reported in a shipped build')

    expect(takeContractReports()).toEqual([
      '[jbrowse display contract] reported in a shipped build',
    ])
  } finally {
    localStorage.removeItem('jbrowseDeveloperMode')
  }
})

test('a production build says nothing until something arms it', async () => {
  const mod = await channel('production')

  expect(mod.contractReportsOn()).toBe(false)
  mod.reportContractViolation('display', 'found before anyone was listening')

  expect(takeContractReports()).toEqual([])
})

test('arming late still surfaces what was found before it', async () => {
  const mod = await channel('production')
  const seen: ContractReport[] = []
  mod.setContractReportSink(report => {
    seen.push(report)
  })

  mod.reportContractViolation('display', 'a display attached twice')
  mod.enableContractReports('a plugin is served from this machine')

  expect(takeContractReports()).toEqual([
    '[jbrowse display contract] a display attached twice',
  ])
  expect(seen).toEqual([
    {
      family: 'display',
      message: 'a display attached twice',
      armedBy: 'a plugin is served from this machine',
    },
  ])
})

// the ordering every attach-time check actually runs in: the channel is armed
// when the plugin loads, the display attaches and reports, and only then does
// the session that can show it exist
test('a sink installed after the arming is still handed what came before it', async () => {
  const mod = await channel('production')

  mod.enableContractReports('localStorage.jbrowseDeveloperMode is set')
  mod.reportContractViolation('display', 'found at attach')

  const seen: ContractReport[] = []
  mod.setContractReportSink(report => {
    seen.push(report)
  })

  expect(takeContractReports()).toEqual([
    '[jbrowse display contract] found at attach',
  ])
  expect(seen).toEqual([
    {
      family: 'display',
      message: 'found at attach',
      armedBy: 'localStorage.jbrowseDeveloperMode is set',
    },
  ])
})

test('the first reason to arm is the one a notice quotes', async () => {
  const mod = await channel('production')
  const seen: ContractReport[] = []
  mod.setContractReportSink(report => {
    seen.push(report)
  })

  mod.enableContractReports('a plugin is served from this machine')
  mod.enableContractReports(
    'this site sets configuration.preferences.developerMode',
  )
  mod.reportContractViolation('display', 'a dead Retry button')

  takeContractReports()
  expect(seen[0]?.armedBy).toBe('a plugin is served from this machine')
})

test('a queue nobody drains is bounded rather than growing', async () => {
  const mod = await channel('production')
  for (let i = 0; i < 50; i++) {
    mod.reportContractViolation('display', `violation ${i}`)
  }
  const seen: ContractReport[] = []
  mod.setContractReportSink(report => {
    seen.push(report)
  })
  mod.enableContractReports('a plugin is served from this machine')

  takeContractReports()
  expect(seen).toHaveLength(20)
  expect(seen.at(-1)?.message).toBe('violation 19')
})

// the in-tree case, where no host ever installs a sink: every report still has
// to reach the console, or the jest gate stops seeing violations after twenty
test('a report past the queue bound is still logged', async () => {
  const mod = await channel('development')
  for (let i = 0; i < 30; i++) {
    mod.reportContractViolation('display', `violation ${i}`)
  }

  expect(takeContractReports()).toHaveLength(30)
})
