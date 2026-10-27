import path from 'node:path'

import { wgslValidator } from './tint.ts'

interface Dawn {
  create: (options: string[]) => GPU
}

// The addon directly, since the package's ESM entry needs `import.meta`.
function loadDawn() {
  const dir = path.dirname(require.resolve('webgpu/package.json'))
  const arch = process.platform === 'darwin' ? 'universal' : process.arch
  return require(
    path.join(dir, 'dist', `${process.platform}-${arch}`, 'dawn.node'),
  ) as Dawn
}

// Module scope, because dawn.node aborts the process when a device outlives a
// collected GPU or adapter.
let gpu: GPU
let adapter: GPUAdapter
let device: GPUDevice

beforeAll(async () => {
  gpu = loadDawn().create(['backend=null'])
  adapter = (await gpu.requestAdapter())!
  device = await adapter.requestDevice()
})

afterAll(() => {
  device.destroy()
})

const fragment = (body: string) =>
  [
    '@fragment fn fs_main(@location(0) v: f32) -> @location(0) vec4f {',
    '  var a = 0.0;',
    body,
    '  return vec4f(a);',
    '}',
  ].join('\n')

test('passes a derivative in uniform control flow', async () => {
  const validate = wgslValidator(device)
  expect(await validate(fragment('  a = fwidth(v);'))).toBeUndefined()
})

// The class GPU_SHADERS.md names, which naga 30 accepts.
test('refuses a derivative under a branch on a varying, at its line', async () => {
  const message = await wgslValidator(device)(
    fragment('  if (v > 0.5) { a = fwidth(v); }'),
  )
  expect(message).toContain(
    `slangc's WGSL 3:22: error: 'fwidth' must only be called from uniform control flow`,
  )
  expect(message).toContain('    3 |   if (v > 0.5) { a = fwidth(v); }')
  expect(message).toContain(`input 'v' of 'fs_main' may be non-uniform`)
})
