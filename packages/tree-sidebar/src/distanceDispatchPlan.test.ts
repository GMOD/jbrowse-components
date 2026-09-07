import { planDistanceDispatch } from './distanceDispatchPlan.ts'

const limits = {
  maxComputeWorkgroupsPerDimension: 65535,
  maxStorageBufferBindingSize: 128 << 20,
  maxBufferSize: 256 << 20,
}
const workgroup = { x: 16, y: 16 }

test('cuts a 1000 Genomes window into 64 MB slabs', () => {
  const plan = planDistanceDispatch(limits, 2504, 22514, workgroup)!
  expect(plan.workgroupsX).toBe(157)
  expect(plan.workgroupsY).toBe(157)
  expect(plan.slabColumns * 2504 * 4).toBeLessThanOrEqual(64 << 20)
  expect(Math.ceil(22514 / plan.slabColumns)).toBe(4)
})

test('a narrow matrix goes up in one slab', () => {
  expect(planDistanceDispatch(limits, 464, 512, workgroup)?.slabColumns).toBe(
    512,
  )
})

test('refuses an output the device cannot bind', () => {
  // 6000^2 * 4 = 144 MB, past the 128 MB binding limit
  expect(planDistanceDispatch(limits, 6000, 100, workgroup)).toBeNull()
  expect(
    planDistanceDispatch(
      { ...limits, maxStorageBufferBindingSize: 1 << 30 },
      6000,
      100,
      workgroup,
    ),
  ).not.toBeNull()
})

test('refuses more workgroups than one axis allows', () => {
  expect(
    planDistanceDispatch(
      { ...limits, maxComputeWorkgroupsPerDimension: 100 },
      2504,
      100,
      workgroup,
    ),
  ).toBeNull()
})
