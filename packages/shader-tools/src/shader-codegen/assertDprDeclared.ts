// Build-time check that a shader converting CSS px to device px declares the
// ratio it converts by.
//
// Every mark in this tree fades its edge over one OUTPUT pixel while its
// coordinates are CSS px. `antialias.slang` owns that conversion and every
// entry point performing it takes a `dpr`, so a shader has to have one to give
// — a uniform, since it is a property of the canvas rather than of an instance.
// Nothing made it declare one, so a shader could antialias against a constant
// instead and be wrong by a factor of dpr, which on a plain monitor is a factor
// of one and therefore invisible to whoever wrote it.
//
// Not hypothetical. gwas' manhattan pass sized its glyph pad from a flat 1.0
// CSS px and had no dpr uniform at all — four times the ramp's reach on a
// retina display — and variants' matrix faded its inversion triangles through a
// bare `smoothstep(-0.5, 0.5, d)`, twice the intended softness at dpr 2. Both
// were found by reading, which is the part that does not scale.
//
// So: reach the conversion, declare the field. The generated `writeUniforms`
// packer makes the write total, so TypeScript then fails the renderer that does
// not supply it, and `getDpr()` is the value every drawing path already owes.
// One field name, because a check cannot follow a synonym.
export const DPR_UNIFORM = 'devicePixelRatio'

// The `antialias` entry points that take a dpr, plus the shape helpers that
// forward one. Matched against the EMITTED source rather than the `.slang`, so
// a call inlined out of an imported module counts — which is the normal case,
// and the one a source grep misses.
const DPR_CONSUMERS = [
  'aaPx',
  'aaHalfPx',
  'edgeCoverage',
  'capsuleQuadLocal',
  'discExpand',
  'segmentQuadLocal',
  'buttSegmentCoverage',
  'dashCoverage',
]

/**
 * Which converters survived inlining into this shader's emitted source. The
 * GLSL halves are optional: a `//! targets: wgsl` compute shader has neither.
 */
export function dprConsumersCalled(emitted: {
  wgsl: string
  glslVertex?: string
  glslFragment?: string
}) {
  const sources = [
    emitted.wgsl,
    emitted.glslVertex,
    emitted.glslFragment,
  ].filter(s => s !== undefined)
  // slangc suffixes every symbol it emits (`edgeCoverage_0`). A hit means the
  // call survived; a miss does not prove the arithmetic is absent, since
  // inlining can fold a wrapper away — so the forward check below is
  // deliberately one-directional.
  return [
    ...new Set(
      sources.flatMap(src =>
        DPR_CONSUMERS.filter(fn => src.includes(`${fn}_0(`)),
      ),
    ),
  ].sort()
}

/**
 * Per shader: reaching the conversion obliges the block to declare the ratio.
 * Returns 1 if this shader converts, so the caller can count them.
 */
export function assertDprDeclared(
  shader: string,
  fieldNames: readonly string[],
  called: readonly string[],
) {
  if (called.length === 0) {
    return 0
  }
  if (!fieldNames.includes(DPR_UNIFORM)) {
    const near = fieldNames.filter(f => /dpr|pixelratio|devicepx/i.test(f))
    throw new Error(
      `${shader} calls ${called.join(', ')}, which convert CSS px to device ` +
        `px, but its uniform block declares no '${DPR_UNIFORM}'.` +
        (near.length > 0
          ? ` It declares ${near.join(', ')} — rename to '${DPR_UNIFORM}', ` +
            `the one spelling this check can follow.`
          : ` Add 'float ${DPR_UNIFORM};' to the block and write it with ` +
            `getDpr(); the generated packer will not let a renderer skip it.`) +
        ` A shader antialiasing against a constant is wrong by a factor of ` +
        `dpr, which is 1 on the machine most people develop on.`,
    )
  }
  return 1
}

export interface DprBlockUse {
  shader: string
  /** The `.slang` declaring the uniform struct — the group key. */
  owner: string
  fieldNames: readonly string[]
  /** Whether any emitted source of this shader names the field at all. */
  reads: boolean
}

/**
 * Tree-wide: a `devicePixelRatio` no shader sharing its block reads is written
 * every frame for nothing.
 *
 * Grouped by the declaring module rather than checked per shader, because a
 * shared block legitimately carries a field only some of its passes read —
 * alignments' one `Uniforms` serves nineteen, of which four antialias.
 *
 * "Reads it", not "converts by it", and that is the line the check can hold.
 * Antialiasing is not the only honest use of the ratio: variants' matrix snaps
 * its column edges to the device grid, which is a conversion with no ramp in
 * it. Insisting every reader route through `antialias` would be asserting a
 * claim about intent that the emitted source cannot settle, so the forward
 * check above carries the weight and this one only catches the field nothing
 * touches.
 */
export function assertNoDeadDprUniform(uses: readonly DprBlockUse[]) {
  const byOwner = new Map<string, DprBlockUse[]>()
  for (const use of uses) {
    byOwner.set(use.owner, [...(byOwner.get(use.owner) ?? []), use])
  }
  for (const [owner, group] of byOwner) {
    const declares = group.some(u => u.fieldNames.includes(DPR_UNIFORM))
    if (declares && group.every(u => !u.reads)) {
      throw new Error(
        `${owner} declares '${DPR_UNIFORM}', but none of the ` +
          `${group.length} shader(s) compiled against it ` +
          `(${group.map(u => u.shader).join(', ')}) read it. The field is ` +
          `dead and every frame writes it for nothing — drop it.`,
      )
    }
  }
}

/** Whether any emitted source names the uniform field. */
export function readsDprUniform(emitted: {
  wgsl: string
  glslVertex?: string
  glslFragment?: string
}) {
  return [emitted.wgsl, emitted.glslVertex, emitted.glslFragment].some(src =>
    src?.includes(`${DPR_UNIFORM}_0`),
  )
}
