// Build-time cross-check that the uniform-block offsets the codegen emits match
// the block slangc actually laid out, in both emitted backends.
//
// The asymmetry this closes: `assertVertexInputsMatch` exists because reflection
// gives no byte offsets for a vertex-input struct, so the tight packing is the
// codegen's own assumption and has to be checked. Uniform offsets ARE reflected,
// which reads like it needs no check — but reflection and code generation are two
// outputs of slangc, and nothing made them agree. `UNIFORM_OFFSET_*`,
// `UNIFORM_SLOT_ARRAYS`, `UNIFORMS_SIZE_BYTES` and every store `writeUniforms`
// emits are derived from the first and consumed against the second, so a
// divergence writes every uniform in the shader to a word it does not read —
// silently, on both backends, with a rendering that is merely wrong rather than
// broken. That is the failure class ADR-005 exists to eliminate, and it was the
// one struct still taken on trust.
//
// It is also the check a `SLANG_VERSION` bump most needs and did not have. The
// oracle covers the lifted functions; nothing covered the layout, and std140's
// array rule — every element padded to 16 bytes, so a `float4[9]` strides 16 and
// not `sizeof(element)` — was a prose claim in reflection.ts's JSDoc.
//
// **Both backends are parsed from their own declaration, not from each other.**
// GLSL carries `layout(std140) uniform Uniforms { … }` and the rule is std140,
// recomputed here. WGSL carries slangc's own `@align(N)` on every member, which
// is the layout the GPU honours, so that side is walked rather than derived.
// Agreement of the two against the reflected offsets is three statements of the
// layout, from three places, and only the reflected one is what TS writes
// through.

/** What the codegen will emit for one uniform field, from reflection. */
export interface ExpectedUniformField {
  name: string
  offsetBytes: number
  /** std140 element stride, for an array field; undefined for a scalar/vector. */
  strideBytes?: number
  elementCount?: number
}

interface DeclaredField {
  name: string
  offsetBytes: number
  strideBytes?: number
  elementCount?: number
}

const roundUp = (n: number, to: number) => Math.ceil(n / to) * to

// std140 alignment and size for the scalar/vector spellings each backend uses.
// One table, two spellings, because the numbers are the same rule.
const GLSL_TYPES: Record<string, { align: number; size: number }> = {
  float: { align: 4, size: 4 },
  int: { align: 4, size: 4 },
  uint: { align: 4, size: 4 },
  vec2: { align: 8, size: 8 },
  ivec2: { align: 8, size: 8 },
  uvec2: { align: 8, size: 8 },
  vec3: { align: 16, size: 12 },
  ivec3: { align: 16, size: 12 },
  uvec3: { align: 16, size: 12 },
  vec4: { align: 16, size: 16 },
  ivec4: { align: 16, size: 16 },
  uvec4: { align: 16, size: 16 },
}

const WGSL_TYPES: Record<string, { align: number; size: number }> = {
  f32: { align: 4, size: 4 },
  i32: { align: 4, size: 4 },
  u32: { align: 4, size: 4 },
  'vec2<f32>': { align: 8, size: 8 },
  'vec2<i32>': { align: 8, size: 8 },
  'vec2<u32>': { align: 8, size: 8 },
  'vec3<f32>': { align: 16, size: 12 },
  'vec3<i32>': { align: 16, size: 12 },
  'vec3<u32>': { align: 16, size: 12 },
  'vec4<f32>': { align: 16, size: 16 },
  'vec4<i32>': { align: 16, size: 16 },
  'vec4<u32>': { align: 16, size: 16 },
}

/**
 * `layout(std140) uniform <Block> { <type> <name>_<n> [<count>]; … }`.
 *
 * The block, not the plain `struct Uniforms_0` that precedes it — slangc emits
 * both, and only the block carries the `layout(std140)` the driver honours. The
 * name suffix slangc mangles on (`bpHi_0`) is stripped, same as the vertex-input
 * check does through `demangle`.
 */
function parseGlslUniformBlock(glsl: string): DeclaredField[] | undefined {
  const block = /layout\(std140\)\s*uniform\s+\w+\s*\{([\s\S]*?)\n\}/.exec(glsl)
  if (!block) {
    return undefined
  }
  const fields: DeclaredField[] = []
  let offset = 0
  for (const m of block[1]!.matchAll(
    /^\s*(\w+)\s+(\w+?)_\d+\s*(?:\[\s*(\d+)\s*\])?\s*;/gm,
  )) {
    const [, type, name, count] = m
    const t = GLSL_TYPES[type!]
    if (!t) {
      throw new Error(
        `uniform field '${name}' is GLSL type '${type}', which the std140 ` +
          `model here has no case for. Extend GLSL_TYPES together with ` +
          `reflection.ts's modeled field types — they describe the same set.`,
      )
    }
    const elementCount = count === undefined ? undefined : Number(count)
    const align = elementCount === undefined ? t.align : Math.max(t.align, 16)
    const strideBytes = elementCount === undefined ? undefined : align
    offset = roundUp(offset, align)
    fields.push({ name: name!, offsetBytes: offset, strideBytes, elementCount })
    offset += elementCount === undefined ? t.size : align * elementCount
  }
  return fields
}

/**
 * The struct `var<uniform>` names, walked by slangc's own `@align(N)` rather
 * than by a rule we reimplement.
 *
 * Found through the `var<uniform> u : <Type>;` declaration and not by struct
 * name: slangc calls it `Uniforms_std140_0` when a member needed std140
 * treatment and `Uniforms_0` when none did, and hardcoding either spelling is
 * how this check would quietly stop finding anything.
 */
function parseWgslUniformStruct(wgsl: string): DeclaredField[] | undefined {
  const decl = /var<uniform>\s+\w+\s*:\s*(\w+)\s*;/.exec(wgsl)
  if (!decl) {
    return undefined
  }
  const struct = new RegExp(
    String.raw`struct ${decl[1]!}\s*\{([\s\S]*?)\n\}`,
  ).exec(wgsl)
  if (!struct) {
    return undefined
  }
  const fields: DeclaredField[] = []
  let offset = 0
  // The type runs to end of line, not to the first comma: `array<vec4<f32>,
  // i32(9)>` has one inside it, and stopping there silently truncated every
  // array member to an unrecognized type.
  for (const m of struct[1]!.matchAll(
    /@align\((\d+)\)\s*(\w+?)_\d+\s*:\s*(.+?),?\s*$/gm,
  )) {
    const [, alignText, name, rawType] = m
    const type = rawType!.trim()
    const array = /^array<(.+),\s*(?:i32\()?(\d+)\)?>$/.exec(type)
    const base = WGSL_TYPES[array ? array[1]!.trim() : type]
    if (!base) {
      throw new Error(
        `uniform field '${name}' is WGSL type '${type}', which the layout ` +
          `model here has no case for. Extend WGSL_TYPES together with ` +
          `reflection.ts's modeled field types — they describe the same set.`,
      )
    }
    const elementCount = array ? Number(array[2]) : undefined
    // A uniform-address-space array strides by its element rounded up to 16,
    // which is std140's rule under another name.
    const strideBytes = array ? roundUp(base.size, 16) : undefined
    offset = roundUp(offset, Number(alignText))
    fields.push({ name: name!, offsetBytes: offset, strideBytes, elementCount })
    offset += array ? strideBytes! * elementCount! : base.size
  }
  return fields
}

function compare(
  what: string,
  expected: readonly ExpectedUniformField[],
  declared: readonly DeclaredField[],
) {
  const byName = new Map(expected.map(f => [f.name, f]))
  for (const got of declared) {
    const want = byName.get(got.name)
    if (!want) {
      throw new Error(
        `${what}: the emitted uniform block declares '${got.name}', which is ` +
          `not a reflected field of the block ` +
          `(${expected.map(f => f.name).join(', ')}). UNIFORM_OFFSET_* would ` +
          `have no entry for it and writeUniforms would never write it`,
      )
    }
    if (got.offsetBytes !== want.offsetBytes) {
      throw new Error(
        `${what}: field '${got.name}' is at byte ${got.offsetBytes} in the ` +
          `emitted block but reflection puts it at ${want.offsetBytes}, which ` +
          `is what UNIFORM_OFFSET_* and writeUniforms address it by`,
      )
    }
    if (got.strideBytes !== want.strideBytes) {
      throw new Error(
        `${what}: array field '${got.name}' strides by ${got.strideBytes} ` +
          `bytes per element in the emitted block and by ${want.strideBytes} ` +
          `in reflection, which is what UNIFORM_SLOT_ARRAYS indexes by`,
      )
    }
    if (got.elementCount !== want.elementCount) {
      throw new Error(
        `${what}: field '${got.name}' has ${got.elementCount} elements in the ` +
          `emitted block and ${want.elementCount} in reflection`,
      )
    }
  }
  const missing = expected.filter(f => !declared.some(d => d.name === f.name))
  if (missing.length > 0) {
    throw new Error(
      `${what}: reflection declares uniform field(s) ` +
        `${missing.map(f => f.name).join(', ')} that the emitted block does ` +
        `not. Every later field's offset then shifts, so this is a layout ` +
        `disagreement rather than a dead field`,
    )
  }
}

// A parse that finds nothing passes, so the two ways of finding nothing have to
// be told apart, and the return type is where that lives: `undefined` means the
// backend declared no uniform block at all, an EMPTY array means it declared one
// whose members did not parse.
//
// The first is legitimate and happens — `flatQuad.slang` declares
// `ConstantBuffer<Uniforms> u` and never reads it, so Slang eliminates the block
// from both emitted backends while reflection goes on reporting it (and the
// codegen goes on emitting a 912-byte `writeUniforms` nothing reads). The second
// is the guard that silently stopped guarding, which is what the vertex-input
// check learned to refuse.
//
// The residual hole is a slangc release that renames the declaration itself:
// every shader would then read as "eliminated" and the check would pass over the
// whole tree. One shader cannot tell that apart, so the tree does — build-shaders
// counts the blocks actually compared and a full build with none is an error.
function assertParsedFields(
  what: string,
  declared: readonly DeclaredField[] | undefined,
) {
  if (declared?.length === 0) {
    throw new Error(
      `${what}: the emitted source declares a uniform block, but none of its ` +
        `members parsed. That means the parser stopped matching what slangc ` +
        `emits — the layout cross-check would silently pass from here on. ` +
        `Update the patterns in assertUniformLayout.ts against the new output.`,
    )
  }
}

/**
 * Throws if either emitted backend lays the uniform block out differently from
 * the reflected offsets the generated module is built on.
 *
 * `expected` is built by the caller from the same reflection `emitInterface`
 * reads, so this pins the numbers that actually ship rather than recomputing a
 * second opinion of them.
 *
 * `totalBytes` is `UNIFORMS_SIZE_BYTES` — the whole-block size a backend
 * allocates. Checked separately from the fields because a block can agree field
 * by field and still disagree on its tail padding, and the buffer is sized from
 * this one.
 *
 * Returns how many emitted backends were actually compared, which the caller
 * totals across the tree — see `assertParsedFields` for the hole that closes.
 */
export function assertUniformLayoutMatches(
  label: string,
  expected: readonly ExpectedUniformField[],
  totalBytes: number,
  shaders: { wgsl?: string; glslVertex?: string },
) {
  let compared = 0
  const last = expected.at(-1)
  if (last) {
    const end =
      last.offsetBytes +
      (last.elementCount === undefined
        ? 4
        : last.strideBytes! * last.elementCount)
    if (totalBytes < end) {
      throw new Error(
        `${label}: UNIFORMS_SIZE_BYTES is ${totalBytes} but the last reflected ` +
          `field '${last.name}' ends at ${end}. A backend allocates the buffer ` +
          `from that size, so the tail would be written past the end`,
      )
    }
  }
  let wgslFound: boolean | undefined
  let glslFound: boolean | undefined
  if (shaders.wgsl !== undefined) {
    const declared = parseWgslUniformStruct(shaders.wgsl)
    assertParsedFields(`${label} (WGSL)`, declared)
    wgslFound = declared !== undefined
    if (declared?.length) {
      compare(`${label} (WGSL)`, expected, declared)
      compared++
    }
  }
  if (shaders.glslVertex !== undefined) {
    const declared = parseGlslUniformBlock(shaders.glslVertex)
    assertParsedFields(`${label} (GLSL)`, declared)
    glslFound = declared !== undefined
    if (declared?.length) {
      compare(`${label} (GLSL)`, expected, declared)
      compared++
    }
  }
  // Elimination is decided by what the entry points read, not by which target is
  // being emitted, so a shader emitting both declares the block in both or in
  // neither. One of each means a parser stopped matching, and this says so on
  // the first shader — where the tree-wide count only notices when BOTH sides
  // break, and a one-sided break merely halves a number nobody reads.
  if (
    wgslFound !== undefined &&
    glslFound !== undefined &&
    wgslFound !== glslFound
  ) {
    throw new Error(
      `${label}: the ${glslFound ? 'GLSL' : 'WGSL'} output declares a uniform ` +
        `block and the ${glslFound ? 'WGSL' : 'GLSL'} one does not. Slang ` +
        `eliminates an unread block from every target at once, so this is not a ` +
        `shader difference — one of the patterns in assertUniformLayout.ts has ` +
        `stopped matching what slangc emits, and that half of the layout ` +
        `cross-check is no longer running.`,
    )
  }
  return compared
}

/** One shader's reflected uniform block, for the cross-shader parity check. */
export interface SharedUniformBlock {
  /** The shader, for the message. */
  shader: string
  /** The `.slang` file whose `struct` declaration every member of the group compiles against. */
  owner: string
  fields: readonly (ExpectedUniformField & { view?: string })[]
  totalBytes: number
}

const signatureOf = (b: SharedUniformBlock) =>
  [
    `${b.totalBytes} bytes`,
    ...b.fields.map(
      f =>
        `${f.name}@${f.offsetBytes}${
          f.elementCount === undefined
            ? ''
            : `[${f.elementCount}x${f.strideBytes}]`
        }${f.view === undefined ? '' : `:${f.view}`}`,
    ),
  ].join(' ')

function firstDisagreement(a: SharedUniformBlock, b: SharedUniformBlock) {
  const names = [...new Set([...a.fields, ...b.fields].map(f => f.name))]
  for (const name of names) {
    const x = a.fields.find(f => f.name === name)
    const y = b.fields.find(f => f.name === name)
    const describe = (f?: SharedUniformBlock['fields'][number]) =>
      f === undefined
        ? 'absent'
        : `byte ${f.offsetBytes}${
            f.elementCount === undefined
              ? ''
              : `, ${f.elementCount} elements striding ${f.strideBytes}`
          }${f.view === undefined ? '' : `, ${f.view}`}`
    if (describe(x) !== describe(y)) {
      return `field '${name}' is ${describe(x)} in ${a.shader} and ${describe(y)} in ${b.shader}`
    }
  }
  return `the block is ${a.totalBytes} bytes in ${a.shader} and ${b.totalBytes} in ${b.shader}`
}

/**
 * Throws if two shaders compiling against the SAME `struct` declaration ended
 * up with different layouts for it.
 *
 * `assertUniformLayoutMatches` checks each shader against its own emitted
 * source, so a group of shaders sharing one declaration can drift apart in
 * lockstep with themselves and every member still passes. The 19 alignments
 * passes are the case that makes this load-bearing: they share one UBO, written
 * once per block render through ONE shader's `UNIFORM_OFFSET_*`
 * (`GpuAlignmentsRenderer` writes through `read`'s), and every other pass reads
 * that buffer at whatever offsets its own generated module claims. A pass whose
 * layout drifts from `read`'s reads every uniform in the shader from a word the
 * renderer never wrote — the same failure class as a per-shader divergence,
 * arrived at from the other side.
 *
 * Returns how many groups had something to compare, i.e. how many declarations
 * are shared by two or more shaders.
 */
export function assertSharedUniformBlocksAgree(
  blocks: readonly SharedUniformBlock[],
) {
  const groups = new Map<string, SharedUniformBlock[]>()
  for (const b of blocks) {
    const group = groups.get(b.owner)
    if (group) {
      group.push(b)
    } else {
      groups.set(b.owner, [b])
    }
  }
  let checked = 0
  // Sorted, because the build compiles shaders concurrently and an unsorted
  // group names whichever finished first as the reference — so the same drift
  // would report a different pair from run to run.
  for (const [owner, members] of [...groups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (members.length < 2) {
      continue
    }
    const sorted = [...members].sort((a, b) => a.shader.localeCompare(b.shader))
    const [reference, ...rest] = sorted as [
      SharedUniformBlock,
      ...SharedUniformBlock[],
    ]
    const want = signatureOf(reference)
    for (const got of rest) {
      if (signatureOf(got) !== want) {
        throw new Error(
          `${got.shader} and ${reference.shader} both compile against the ` +
            `uniform struct declared in ${owner}, but they lay it out ` +
            `differently: ${firstDisagreement(reference, got)}. One ` +
            `declaration cannot have two layouts, so the generated modules ` +
            `disagree about a buffer they share — whichever shader's ` +
            `UNIFORM_OFFSET_* the TS side writes through, the other reads its ` +
            `uniforms from words nobody wrote.`,
        )
      }
    }
    checked++
  }
  return checked
}
