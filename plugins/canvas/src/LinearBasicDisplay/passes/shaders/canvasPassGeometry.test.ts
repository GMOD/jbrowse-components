// Two agreements between these passes that the compiler cannot see, both
// load-bearing at the HAL and neither stated anywhere in TypeScript.
//
// The first is the instance layout. `GpuCanvasFeatureRenderer` issues
// `drawPass(chevron, region, bufferPassId=line)`, so the chevron pipeline
// rasterizes bytes that were packed for `line` — a layout that drifted would
// silently reinterpret them, on both backends, with nothing to attribute the
// picture to. What makes that safe is that both shaders declare the same
// `LineInstance` struct out of `lineInstance.slang`, so both modules reflect the
// same stride and the same attributes.
//
// `makeChevronPass` used to state it a second way, copying line's
// `INSTANCE_STRIDE_BYTES` and `VERTEX_ATTRIBUTES` onto the chevron descriptor
// through `slangPass`'s `bufferStride` / `bufferAttributes`. That pair is gone:
// it restated the agreement rather than causing it, and would have masked the
// two structs parting company — the chevron pass would have gone on reading
// line's bytes through line's layout while its own shader declared something
// else. Removing it is what makes this test necessary rather than redundant.
// `syntenyPassGeometry.test.ts` is the same argument one plugin over, and made
// the same transition first.
//
// The second is the uniform block. The renderer writes ONE buffer, sized by
// `rectShader.UNIFORMS_SIZE_BYTES` and packed by `rectShader.writeUniforms`, and
// every pass reads it — so a shader whose `FeatureGlyphUniforms` disagreed would
// read a field from the wrong offset.
import * as arrowShader from './arrow.iface.generated.ts'
import * as chevronShader from './chevron.iface.generated.ts'
import * as continuationShader from './continuation.iface.generated.ts'
import * as lineShader from './line.iface.generated.ts'
import * as rectShader from './rect.iface.generated.ts'

describe('canvas feature pass geometry', () => {
  // Every assertion below compares two generated values, so all of them pass if
  // both sides go missing — the emitter drops an offset map a struct no longer
  // needs, and this becomes `undefined === undefined`. Anchor on what the
  // structs hold today so that the check fails rather than empties. Same
  // reasoning as `assertParsedSomething` in assertVertexInputs.ts.
  test('the layouts under test are not empty', () => {
    expect(lineShader.INSTANCE_STRIDE_BYTES).toBeGreaterThan(0)
    expect(Object.keys(lineShader.INSTANCE_OFFSET_F32).length).toBeGreaterThan(
      0,
    )
    expect(Object.keys(lineShader.INSTANCE_OFFSET_U32).length).toBeGreaterThan(
      0,
    )
    expect(lineShader.VERTEX_ATTRIBUTES.length).toBeGreaterThan(0)
    expect(rectShader.UNIFORMS_SIZE_BYTES).toBeGreaterThan(0)
    expect(Object.keys(rectShader.UNIFORM_OFFSET_F32).length).toBeGreaterThan(0)
  })

  test('chevron and line share an instance layout', () => {
    expect(chevronShader.INSTANCE_STRIDE_BYTES).toBe(
      lineShader.INSTANCE_STRIDE_BYTES,
    )
    // Per view, so this also says the two agree about each field's TYPE — a
    // field that moved between the f32 and u32 maps would keep its word offset
    // and still fail here.
    expect(chevronShader.INSTANCE_OFFSET_F32).toEqual(
      lineShader.INSTANCE_OFFSET_F32,
    )
    expect(chevronShader.INSTANCE_OFFSET_U32).toEqual(
      lineShader.INSTANCE_OFFSET_U32,
    )
    // The layout each HAL builds its pipeline from, and the one the dropped
    // `bufferAttributes` override used to supply.
    expect(chevronShader.VERTEX_ATTRIBUTES).toEqual(
      lineShader.VERTEX_ATTRIBUTES,
    )
  })

  test('every pass shares the uniform block the renderer writes', () => {
    for (const mod of [
      lineShader,
      arrowShader,
      chevronShader,
      continuationShader,
    ]) {
      expect(mod.UNIFORMS_SIZE_BYTES).toBe(rectShader.UNIFORMS_SIZE_BYTES)
      expect(mod.UNIFORM_OFFSET_F32).toEqual(rectShader.UNIFORM_OFFSET_F32)
      expect(mod.UNIFORM_OFFSET_U32).toEqual(rectShader.UNIFORM_OFFSET_U32)
    }
  })
})
