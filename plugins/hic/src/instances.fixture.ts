import { packInstances } from './LinearHicDisplay/components/shaders/hic.iface.generated.ts'

/**
 * A packed instance buffer built from the readable parallel arrays fixtures
 * want to write.
 *
 * The payload is interleaved (see `HicDataResult.instances`), but a fixture
 * spelling `[10, 20, 5, 30, 40, 15]` says nothing about which number is which.
 * Round-tripping through the shader's own `packInstances` keeps fixtures
 * legible without restating the stride anywhere, and means every test that
 * reads a payload back through the generated accessors is also checking those
 * accessors against the generated packer.
 *
 * `positions` is two values per contact (x, y); `counts` is one.
 */
export function packTestInstances(positions: number[], counts: number[]) {
  return new Float32Array(
    packInstances({ position: positions, count: counts }, counts.length),
  )
}
