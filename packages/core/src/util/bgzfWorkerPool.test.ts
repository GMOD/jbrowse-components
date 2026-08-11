import { sharedBgzfWorkerPool } from './bgzfWorkerPool.ts'

// Nine tabix adapters and the BAM adapter pass this straight into their file
// constructors with no environment check, on the strength of it being undefined
// wherever Workers cannot be created. If that ever stops holding under jest,
// every one of those suites starts spawning real workers it never tears down —
// so pin it here rather than finding out as a leak somewhere else.
test('resolves to undefined where Workers cannot be created', async () => {
  await expect(sharedBgzfWorkerPool()).resolves.toBeUndefined()
})
