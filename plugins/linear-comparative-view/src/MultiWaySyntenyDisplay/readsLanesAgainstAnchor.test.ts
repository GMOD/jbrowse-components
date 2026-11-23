import { createDisplayWithSession } from './testEnv.ts'

async function until(done: () => boolean) {
  const deadline = Date.now() + 5000
  while (!done() && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 10))
  }
  expect(done()).toBe(true)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function recordedCalls() {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  createDisplayWithSession({
    syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
    trackAssemblyNames: ['volvox', 'HG00097.1', 'HG00099.1'],
    rpc: async (name, args) => {
      calls.push({ name, args })
      return name === 'CoreGetInfo' ? { hasCoarseTier: false } : []
    },
  })
  return calls
}

test('the header read says the display reads lanes against the anchor when the header asks', async () => {
  const calls = recordedCalls()
  await until(() => calls.some(c => c.name === 'CoreGetInfo'))
  expect(
    calls.find(c => c.name === 'CoreGetInfo')!.args.readsLanesAgainstAnchor,
  ).toBe(true)
})

test('every anchor fetch says the display reads lanes against the anchor when the header asks', async () => {
  const calls = recordedCalls()
  const anchorFetches = () =>
    calls
      .filter(c => c.name === 'MultiWayGetFeatures')
      .map(c => c.args.opts)
      .filter(isRecord)
      .filter(opts => !('lanePairs' in opts))
  await until(() => anchorFetches().length > 0)
  expect(anchorFetches().map(opts => opts.readsLanesAgainstAnchor)).toEqual(
    anchorFetches().map(() => true),
  )
})
