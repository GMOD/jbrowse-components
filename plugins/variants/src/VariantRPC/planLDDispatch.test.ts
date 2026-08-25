import { planLDDispatch } from './ldDispatchPlan.ts'

const SPEC_FLOOR = 128 * 1024 * 1024

// The WebGPU spec's guaranteed minimums, which is the device the ceilings in
// `agent-docs/reference/ARCHITECTURAL_LIMITS.md` are quoted against.
const FLOOR_LIMITS = {
  maxComputeWorkgroupsPerDimension: 65535,
  maxStorageBufferBindingSize: SPEC_FLOOR,
  maxBufferSize: 268_435_456,
}

const WORKGROUP = 64

test('an ordinary matrix plans a 2D grid covering every cell', () => {
  const numCells = 1_000_000
  const plan = planLDDispatch(FLOOR_LIMITS, numCells, 1_000_000, WORKGROUP)!

  expect(plan).not.toBeNull()
  expect(plan.width * plan.height * WORKGROUP).toBeGreaterThanOrEqual(numCells)
  // the kernel rebuilds the flat index as gid.y * rowStride + gid.x
  expect(plan.rowStride).toBe(plan.width * WORKGROUP)
})

test('an output buffer past the limit declines', () => {
  const cells = SPEC_FLOOR / 4
  expect(planLDDispatch(FLOOR_LIMITS, cells, 1024, WORKGROUP)).not.toBeNull()
  expect(planLDDispatch(FLOOR_LIMITS, cells + 1, 1024, WORKGROUP)).toBeNull()
})

// The genotype buffer was unchecked. It reached the CPU path anyway, but only
// because `createBuffer` runs outside `runGPUCompute`'s error scope and the
// scope caught the later bind-group failure instead — a plan-time refusal is
// the deliberate version of that, and costs no allocation.
test('an input buffer past the limit declines too', () => {
  expect(
    planLDDispatch(FLOOR_LIMITS, 1000, SPEC_FLOOR, WORKGROUP),
  ).not.toBeNull()
  expect(
    planLDDispatch(FLOOR_LIMITS, 1000, SPEC_FLOOR + 1, WORKGROUP),
  ).toBeNull()
})

// Bit-planed, the composite kernel's input is `n * 3 * ceil(samples/32) * 4`
// bytes — 3/8 of the `n * samples` the byte loop uploaded. At 2,504 samples
// (1000 Genomes) that moves the floor from 53,601 variants to 141,579.
test('the bit-planed input reaches the spec floor at 8/3 the variants', () => {
  const samples = 2504
  const words = Math.ceil(samples / 32)
  const bitPlaned = (n: number) => n * 3 * words * 4
  const byteLoop = (n: number) => n * samples

  const fits = (bytes: number) =>
    planLDDispatch(FLOOR_LIMITS, 1000, bytes, WORKGROUP) !== null

  expect(fits(bitPlaned(141_579))).toBe(true)
  expect(fits(bitPlaned(141_580))).toBe(false)
  expect(fits(byteLoop(53_601))).toBe(true)
  expect(fits(byteLoop(53_602))).toBe(false)
})

// A 1D dispatch caps at 65,535 workgroups, i.e. ~4.19M cells, which ~2,896 SNPs
// already exceeds — so the grid has to spill into y, and the plan is null only
// when even that is not enough.
test('cells spill into the second dimension rather than declining', () => {
  const beyond1D = FLOOR_LIMITS.maxComputeWorkgroupsPerDimension * WORKGROUP + 1
  const plan = planLDDispatch(
    { ...FLOOR_LIMITS, maxStorageBufferBindingSize: 2 ** 31 },
    beyond1D,
    1024,
    WORKGROUP,
  )!
  expect(plan.width).toBe(FLOOR_LIMITS.maxComputeWorkgroupsPerDimension)
  expect(plan.height).toBe(2)
})

// The same two ceilings read along the sample axis, which is the one a growing
// cohort moves: at a 2,048-variant window the byte loop broke at 65,536 samples,
// and the three planes reach the floor at 174,752.
test('the sample ceiling moves with the same 8/3 at a fixed window', () => {
  const n = 2048
  const bitPlaned = (samples: number) => n * 3 * Math.ceil(samples / 32) * 4
  const byteLoop = (samples: number) => n * samples

  const fits = (bytes: number) =>
    planLDDispatch(FLOOR_LIMITS, 1000, bytes, WORKGROUP) !== null

  expect(fits(byteLoop(65_536))).toBe(true)
  expect(fits(byteLoop(65_537))).toBe(false)
  expect(fits(bitPlaned(174_752))).toBe(true)
  expect(fits(bitPlaned(174_753))).toBe(false)
})
