// One exhaustive classification of a shader's GPU binding table, derived from
// slangc's reflection.
//
// It backstops a family of `find<TheOneIExpect>` accessors —
// `findConstantBuffer`, `findInstanceStruct`, `findCombinedSamplers` — each of
// which scans `reflection.parameters` for the shape it wants, returns the first
// match, and ignores everything else. They still do that; what changed is that
// this runs first and refuses the shader shapes that would make first-match the
// wrong answer, so their scans are now safe rather than merely lucky. (Folding
// them into genuine projections of this table would mean carrying each one's
// struct payload through `ShaderBinding`, which buys no safety over the
// refusal.) Their failure mode was a shader declaring something the scan wasn't
// looking for:
//
//   ConstantBuffer<A> ua;   // canvasSize, k
//   ConstantBuffer<B> ub;   // scale, bias
//
// `findConstantBuffer` returned `ua` and `ub` simply vanished — no error, a
// `UNIFORMS_SIZE_BYTES` covering only the first block, a `Uniforms` interface
// with no `scale`/`bias`, and a `@binding(1)` in the emitted WGSL that nothing
// would ever write. (The runtime has one `writeUniforms(data)`, so a second
// block could never have worked; the point is that nothing said so.)
//
// Classifying every parameter and refusing what it cannot place turns that whole
// family into one rule: an unbindable or unrecognized parameter is a build
// error naming the parameter and its reflected shape.
//
// The binding table is also the thing three separate places were asserting by
// hand — the render HALs' uniform-only layout (uniform at 1) and their textured
// one (uniform 1, texture 2, sampler 3), and the LD compute driver's own
// `makeBindGroupLayout` (0 read-only-storage, 1 storage, 2 uniform) — none of
// which consulted reflection. Emitting it lets a consumer build its layout from
// the shader instead of from a comment promising the two agree, and each entry
// carries the stages that read it, so the layout's `visibility` comes from the
// shader too.

import { tokenize } from './wgslToJs.ts'

import type { EntryPoint, Parameter, Reflection } from './reflection.ts'

/**
 * A binding kind, spelled as WebGPU spells it so a consumer can hand the value
 * straight to `createBindGroupLayout`. `@jbrowse/render-core/hal` declares the
 * matching `ShaderBinding` interface that generated modules are typed against —
 * shader-tools must not depend on render-core, the same arrangement already in
 * place for `VertexAttributeLayout` and `TextureBinding`.
 */
export type BindingKind =
  | 'uniform'
  | 'texture'
  | 'sampler'
  | 'storage'
  | 'read-only-storage'

export type ShaderStage = EntryPoint['stage']

export interface ShaderBinding {
  index: number
  kind: BindingKind
  /** The shader author's name. A combined sampler contributes two bindings under one name. */
  name: string
  /** The entry points that read it — what a layout's `visibility` shows it to. */
  stages: readonly ShaderStage[]
}

function classifyOne(
  label: string,
  p: Parameter,
): Omit<ShaderBinding, 'stages'>[] {
  const t = p.type
  const at = (kind: BindingKind, index: number) => ({
    index,
    kind,
    name: p.name,
  })
  const bad = (why: string): never => {
    throw new Error(
      `${label}: parameter '${p.name}' ${why}. The codegen classifies every ` +
        `shader parameter into a binding it can describe — a uniform block, a ` +
        `structured buffer, or a combined Sampler2D — and refuses the rest, ` +
        `because the alternative is a binding the emitted table doesn't ` +
        `mention and no consumer ever binds.`,
    )
  }
  // A descriptor-table slot is the only binding a module-scope parameter can
  // carry, so this branch means it carries none at all.
  if (p.binding?.kind !== 'descriptorTableSlot') {
    return bad('has no descriptor-table binding, so nothing can bind it')
  }
  const index = p.binding.index
  if (t.kind === 'constantBuffer') {
    return [at('uniform', index)]
  }
  if (t.kind === 'resource') {
    if (t.baseShape === 'structuredBuffer') {
      return [
        at(t.access === 'readWrite' ? 'storage' : 'read-only-storage', index),
      ]
    }
    // A combined `Sampler2D<T>` consumes two slots and reflects `count: 2` —
    // the texture at `index`, its sampler at `index + 1`.
    if (t.baseShape === 'texture2D' && t.combined) {
      return [at('texture', index), at('sampler', index + 1)]
    }
    return bad(
      `is a '${t.baseShape}' resource${t.combined ? ' (combined)' : ''}, ` +
        `which has no binding form here. A separate Texture2D + SamplerState ` +
        `pair is the shape most likely to land here: declare it as one ` +
        `Sampler2D<T> instead`,
    )
  }
  return bad(`reflects as '${t.kind}', which is not a bindable resource`)
}

// Whether each entry point reads the parameter. A flag slangc left out is a
// failure rather than a "no": a stage omitted here is one the WebGPU layout
// hides the binding from.
function stagesReading(
  label: string,
  reflection: Reflection,
  name: string,
): ShaderStage[] {
  return reflection.entryPoints.flatMap(e => {
    const used = e.bindings.find(b => b.name === name)?.binding.used
    if (used === undefined) {
      throw new Error(
        `${label}: slangc did not say whether entry point '${e.name}' reads ` +
          `'${name}'. It marks a binding \`used\` only for an entry point ` +
          `compiled alone (withEntryPointReads), and the WebGPU bind-group ` +
          `layout shows each binding to exactly the stages marked.`,
      )
    }
    return used ? [e.stage] : []
  })
}

/**
 * Every binding the shader declares, in index order, with the stages that read
 * it.
 *
 * Refuses a duplicate index and a second uniform block. The duplicate check is
 * what makes the combined-sampler expansion safe: it invents `index + 1` for the
 * sampler on slangc's behalf, and a collision there would silently overwrite a
 * real binding in the emitted table.
 */
export function classifyBindings(
  label: string,
  reflection: Reflection,
): ShaderBinding[] {
  const out = reflection.parameters.flatMap(p => {
    const shapes = classifyOne(label, p)
    const stages = stagesReading(label, reflection, p.name)
    return shapes.map(b => ({ ...b, stages }))
  })
  const byIndex = new Map<number, ShaderBinding>()
  for (const b of out) {
    const prior = byIndex.get(b.index)
    if (prior) {
      throw new Error(
        `${label}: binding ${b.index} is claimed by both '${prior.name}' ` +
          `(${prior.kind}) and '${b.name}' (${b.kind})`,
      )
    }
    byIndex.set(b.index, b)
  }
  const uniforms = out.filter(b => b.kind === 'uniform')
  if (uniforms.length > 1) {
    throw new Error(
      `${label}: ${uniforms.length} uniform blocks ` +
        `(${uniforms.map(u => u.name).join(', ')}), but the codegen emits one ` +
        `Uniforms interface and one writeUniforms(), and the runtime writes one ` +
        `uniform buffer per pass. Every block after the first used to be ` +
        `dropped in silence. Merge them into one ConstantBuffer.`,
    )
  }
  return out.sort((a, b) => a.index - b.index)
}

const WGSL_BINDING_RE =
  /@binding\((\d+)\)\s*@group\((\d+)\)\s*var(?:<([^>]*)>)?\s*(\w+)\s*:\s*([^;]+);/g

function wgslBindingKind(addressSpace: string | undefined, type: string) {
  if (addressSpace === undefined) {
    if (type.startsWith('texture_')) {
      return 'texture' as const
    }
    return type.trim() === 'sampler' ? ('sampler' as const) : undefined
  }
  const [space, access] = addressSpace.split(',').map(s => s.trim())
  if (space === 'uniform') {
    return 'uniform' as const
  }
  if (space === 'storage') {
    return access === 'read_write'
      ? ('storage' as const)
      : ('read-only-storage' as const)
  }
  return undefined
}

/**
 * Cross-check the classified table against the bindings slangc actually emitted.
 *
 * Same doctrine as `assertVertexInputsMatch`, and worth stating why it earns its
 * place when this one — unlike the vertex-attribute case — is not checking a
 * model the codegen invented. Reflection really does report binding indices, so
 * this is not "derive then verify"; it is two independent outputs of the same
 * compiler being made to agree. The reflection JSON and the emitted WGSL are
 * produced by different slangc passes, and the pin moves. A bump that changed
 * how `Sampler2D` expands — the one binding here that the codegen *does* invent,
 * since the classifier assigns the sampler `index + 1` on slangc's behalf —
 * would otherwise surface as a WebGPU validation failure on whichever machine
 * ran the shader next, not at `pnpm gen:shaders`.
 *
 * Names are deliberately not compared: a combined sampler is one Slang
 * declaration and two WGSL variables (`colorRamp_texture_0`,
 * `colorRamp_sampler_0`), and the classifier reports the author's single name
 * for both.
 *
 * **One-directional, like the vertex-input check, and for the same reason.**
 * slangc drops a binding the shader body never reads: a shader declaring
 * `ConstantBuffer<Uniforms> u` and then taking every value from its instance
 * attributes (alignments' selection-frame shader did, until the frame became
 * the chrome's guide) has reflection report the uniform while the WGSL has no
 * `@binding(1)` at all. That is DCE, not divergence, and it is harmless — a
 * pipeline layout may declare bindings the shader doesn't use. What must hold is
 * the other direction: nothing the WGSL *declares* may be missing from the table
 * or carry a different kind there, because that is a binding the emitted table
 * doesn't mention and no consumer would bind.
 */
export function assertBindingsMatchWgsl(
  label: string,
  bindings: readonly ShaderBinding[],
  wgsl: string,
) {
  const declared = new Map<number, BindingKind>()
  for (const m of wgsl.matchAll(WGSL_BINDING_RE)) {
    const index = Number(m[1])
    const group = Number(m[2])
    if (group !== 0) {
      throw new Error(
        `${label}: WGSL declares @group(${group}) for binding ${index}; both ` +
          `HALs and the compute drivers only ever setBindGroup(0, …), so ` +
          `nothing would bind it`,
      )
    }
    const kind = wgslBindingKind(m[3], m[5]!)
    if (kind === undefined) {
      throw new Error(
        `${label}: WGSL binding ${index} ('${m[4]}') is ` +
          `'var${m[3] ? `<${m[3]}>` : ''} … : ${m[5]!.trim()}', which the ` +
          `binding classifier has no kind for. Teach bindings.ts both halves ` +
          `at once — the reflection side and this one.`,
      )
    }
    declared.set(index, kind)
  }
  const byIndex = new Map(bindings.map(b => [b.index, b]))
  for (const [index, kind] of declared) {
    const b = byIndex.get(index)
    if (!b) {
      throw new Error(
        `${label}: the emitted WGSL declares a ${kind} at binding ${index}, ` +
          `which the classified binding table does not mention — so no ` +
          `consumer would bind it. Extend classifyBindings rather than ` +
          `dropping the check.`,
      )
    }
    if (b.kind !== kind) {
      throw new Error(
        `${label}: binding ${index} ('${b.name}') is a ${b.kind} by ` +
          `reflection and a ${kind} in the emitted WGSL. If this followed a ` +
          `SLANG_VERSION bump, the two outputs have diverged.`,
      )
    }
  }
}

const isStage = (text: string | undefined): text is ShaderStage =>
  text === 'vertex' || text === 'fragment' || text === 'compute'

/**
 * Each entry point of the emitted WGSL, with the binding indices it statically
 * uses: the module-scope variables its body names, or that the body of any
 * function it calls names. That is WebGPU's own rule for which layout entries a
 * pipeline stage has to see.
 */
function wgslEntryPointReads(wgsl: string) {
  const indexOf = new Map<string, number>()
  for (const m of wgsl.matchAll(WGSL_BINDING_RE)) {
    indexOf.set(m[4]!, Number(m[1]))
  }
  const tokens = tokenize(wgsl)
  const named = new Map<string, Set<string>>()
  const entries: { name: string; stage: ShaderStage }[] = []
  let stage: ShaderStage | undefined
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    const next = tokens[i + 1]?.text
    if (t.text === '@' && isStage(next)) {
      stage = next
    } else if (t.kind === 'ident' && t.text === 'fn' && next !== undefined) {
      let j = i + 2
      while (tokens[j]!.text !== '{') {
        j++
      }
      const body = new Set<string>()
      for (let depth = 0; ; j++) {
        const u = tokens[j]!
        if (u.text === '{') {
          depth++
        } else if (u.text === '}') {
          depth--
          if (depth === 0) {
            break
          }
        } else if (u.kind === 'ident' && tokens[j - 1]!.text !== '.') {
          body.add(u.text)
        }
      }
      named.set(next, body)
      if (stage) {
        entries.push({ name: next, stage })
        stage = undefined
      }
      i = j
    }
  }
  const readsOf = (fn: string, seen: Set<string>, reads: Set<number>) => {
    for (const id of named.get(fn) ?? []) {
      const index = indexOf.get(id)
      if (index !== undefined) {
        reads.add(index)
      } else if (named.has(id) && !seen.has(id)) {
        seen.add(id)
        readsOf(id, seen, reads)
      }
    }
    return reads
  }
  return entries.map(({ name, stage }) => ({
    name,
    stage,
    reads: readsOf(name, new Set([name]), new Set()),
  }))
}

/**
 * Refuse a table whose `stages` leave out a stage the emitted WGSL reads the
 * binding in.
 *
 * `stages` comes from reflection, and the WebGPU HAL builds each binding's
 * layout `visibility` from it, so a stage missing there is a pipeline WebGPU
 * refuses on every machine where it is the first rung — after which the display
 * falls to WebGL2 without a word. The WGSL is what that validation reads, so it
 * is what this compares against: the same doctrine as `assertBindingsMatchWgsl`,
 * and one-directional for the same reason, since a stage reflection names that
 * the WGSL never reads only widens a layout.
 *
 * Every entry point reflection names has to be found in the WGSL, or a change
 * in how slangc spells one would leave this comparing nothing.
 */
export function assertStageReadsMatchWgsl(
  label: string,
  bindings: readonly ShaderBinding[],
  entryPoints: readonly Pick<EntryPoint, 'name' | 'stage'>[],
  wgsl: string,
) {
  const found = wgslEntryPointReads(wgsl)
  for (const e of entryPoints) {
    if (!found.some(f => f.name === e.name && f.stage === e.stage)) {
      throw new Error(
        `${label}: reflection names the ${e.stage} entry point '${e.name}', ` +
          `and no '@${e.stage} fn ${e.name}' was found in the emitted WGSL, ` +
          `so nothing checked which bindings it reads.`,
      )
    }
  }
  for (const { name, stage, reads } of found) {
    for (const index of reads) {
      const b = bindings.find(x => x.index === index)
      if (b && !b.stages.includes(stage)) {
        throw new Error(
          `${label}: the ${stage} entry point '${name}' reads binding ` +
            `${index} ('${b.name}', a ${b.kind}) in the emitted WGSL, but ` +
            `reflection lists ${b.stages.length > 0 ? `only ${b.stages.join(' and ')}` : 'no stage'} ` +
            `as reading it. The WebGPU layout shows a binding to the stages ` +
            `reflection names, so this pipeline would be refused. After a ` +
            `SLANG_VERSION bump, this means slangc's per-entry-point \`used\` ` +
            `flags and its WGSL have diverged.`,
        )
      }
    }
  }
}

// The binding tables the render path can actually bind: the HALs fill the
// uniform block from one ring and bind at most one texture, so a render shader
// that reflects anything else compiles and then fails at pipeline creation, on
// a machine that isn't the author's.
//
// This is a guard, not a second declaration: nothing here is used to bind
// anything. `PipelineDescriptor.bindings` carries the shader's own table to the
// HAL, which builds its WebGPU layout from it.
const RENDER_SHAPES = ['uniform@1', 'uniform@1,texture@2,sampler@3'] as const

function bindingShape(bindings: readonly ShaderBinding[]) {
  return bindings.map(b => `${b.kind}@${b.index}`).join(',')
}

/**
 * Refuse a render shader whose bindings the HALs could not bind.
 *
 * Compute shaders are exempt: their driver creates its own layout, and can now
 * derive it from the emitted table rather than restating it.
 */
export function assertRenderBindingShape(
  label: string,
  bindings: readonly ShaderBinding[],
) {
  const shape = bindingShape(bindings)
  if (!(RENDER_SHAPES as readonly string[]).includes(shape)) {
    throw new Error(
      `${label}: binding table '${shape}' is not one the render HALs bind. ` +
        `They implement '${RENDER_SHAPES.join("' and '")}' — the uniform block ` +
        `at binding 1, and optionally one combined Sampler2D at 2/3. The HALs' ` +
        `layouts used to promise this in a comment ("Binding index 1 matches ` +
        `what the codegen emits"); this checks it. Adjust the shader's ` +
        `[[vk::binding]] attributes, or teach both HALs the new shape first.`,
    )
  }
}
