// Two agreements between these passes that the compiler cannot see, both
// load-bearing at the HAL and neither stated anywhere in TypeScript.
//
// The first is the instance layout. The chevron and continuation marks are
// declared `bufferOf` the line and rect marks, so each pipeline rasterizes bytes
// packed for its lender, and the WebGPU HAL takes each `shaderLocation` from the
// lender's VERTEX_ATTRIBUTES index. A field inserted on one side alone re-points
// every later attribute, on GPU machines only, with nothing thrown.
// `lineInstance.slang` and `rectInstance.slang` declare each pair's struct once;
// this checks no shader has re-declared a local one. The chevron pass used to
// copy line's stride and attributes onto its descriptor (`bufferStride` /
// `bufferAttributes`), which would have masked the two structs parting company,
// and `syntenyPassGeometry.test.ts` is the same argument one plugin over.
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

const SHARED_LAYOUT_PAIRS = [
  { borrower: 'chevron', lender: 'line', b: chevronShader, a: lineShader },
  {
    borrower: 'continuation',
    lender: 'rect',
    b: continuationShader,
    a: rectShader,
  },
] as const

describe('feature pass geometry', () => {
  // Every assertion below compares two generated values, so all of them pass if
  // both sides go missing — the emitter drops an offset map a struct no longer
  // needs, and this becomes `undefined === undefined`. Anchor on what the
  // structs hold today so that the check fails rather than empties. Same
  // reasoning as `assertParsedSomething` in assertVertexInputs.ts.
  test.each(SHARED_LAYOUT_PAIRS)(
    '$lender’s instance layout is not empty',
    ({ a }) => {
      expect(a.INSTANCE_STRIDE_BYTES).toBeGreaterThan(0)
      expect(Object.keys(a.INSTANCE_OFFSET_F32).length).toBeGreaterThan(0)
      expect(Object.keys(a.INSTANCE_OFFSET_U32).length).toBeGreaterThan(0)
      expect(a.VERTEX_ATTRIBUTES.length).toBeGreaterThan(0)
    },
  )

  test('the uniform block under test is not empty', () => {
    expect(rectShader.UNIFORMS_SIZE_BYTES).toBeGreaterThan(0)
    expect(Object.keys(rectShader.UNIFORM_OFFSET_F32).length).toBeGreaterThan(0)
  })

  test.each(SHARED_LAYOUT_PAIRS)(
    '$borrower draws from $lender’s instance layout',
    ({ a, b }) => {
      expect(b.INSTANCE_STRIDE_BYTES).toBe(a.INSTANCE_STRIDE_BYTES)
      // Per view, so a field that moved between the f32 and u32 maps keeps
      // its word offset and still fails here.
      expect(b.INSTANCE_OFFSET_F32).toEqual(a.INSTANCE_OFFSET_F32)
      expect(b.INSTANCE_OFFSET_U32).toEqual(a.INSTANCE_OFFSET_U32)
      expect(b.VERTEX_ATTRIBUTES).toEqual(a.VERTEX_ATTRIBUTES)
    },
  )

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
