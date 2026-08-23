import { slangPass } from './slangPass.ts'

import type { BlendState, TextureBinding } from './hal/types.ts'
import type { ShaderModule } from './slangPass.ts'

const ATTRS = [
  {
    name: 'a_pos',
    components: 2,
    type: 'float',
    offsetBytes: 0,
    integer: false,
  },
] as const

function shaderModule(extra: Partial<ShaderModule> = {}): ShaderModule {
  return {
    WGSL_SOURCE: 'wgsl',
    GLSL_VERTEX: 'vs',
    GLSL_FRAGMENT: 'fs',
    INSTANCE_STRIDE_BYTES: 16,
    VERTEX_ATTRIBUTES: ATTRS,
    ...extra,
  }
}

const MAX_BLEND: BlendState = { op: 'max' }
const SRC_OVER: BlendState = {
  srcFactor: 'src-alpha',
  dstFactor: 'one-minus-src-alpha',
}

describe('slangPass', () => {
  it('carries the shader-owned fields straight through', () => {
    const desc = slangPass({
      id: 'rect',
      mod: shaderModule({ VERTS_PER_INSTANCE: 6 }),
    })

    expect(desc).toMatchObject({
      id: 'rect',
      wgslSource: 'wgsl',
      glslVertex: 'vs',
      glslFragment: 'fs',
      instanceStride: 16,
      verticesPerInstance: 6,
      vertexAttributes: ATTRS,
      // Nothing disables blending today, which is why there is no `//! blend:
      // none` for a module to inherit it from — so the default is on.
      blend: true,
    })
  })

  it('names the fix when no vertex count is available from either side', () => {
    // The message is the whole value here: the author's next move is to add one
    // line to the .slang, and a bare "undefined" would not say which line.
    expect(() => slangPass({ id: 'rect', mod: shaderModule() })).toThrow(
      /slangPass\(rect\).*VERTS_PER_INSTANCE/s,
    )
  })

  it('lets the consumer override the shader vertex count', () => {
    // The canvas chevron pass: its count is the shader's own times a cap the
    // renderer chooses, so the module cannot state it.
    const desc = slangPass({
      id: 'chevron',
      mod: shaderModule({ VERTS_PER_INSTANCE: 3 }),
      verticesPerInstance: 30,
    })

    expect(desc.verticesPerInstance).toBe(30)
  })

  it('inherits topology and blend from the module when the pass says nothing', () => {
    const desc = slangPass({
      id: 'line',
      mod: shaderModule({
        VERTS_PER_INSTANCE: 2,
        TOPOLOGY: 'line-list',
        BLEND_STATE: MAX_BLEND,
      }),
    })

    expect(desc.topology).toBe('line-list')
    expect(desc.blendState).toEqual(MAX_BLEND)
  })

  it('lets two passes over one shader disagree about blend and topology', () => {
    // Wiggle's step line and center line share wiggleLine.slang and blend
    // differently (src-over against max), which is why that shader declares no
    // `//! blend:` and each pass states its own. A module value winning here
    // would collapse the two onto whichever the shader happened to name.
    const mod = shaderModule({
      VERTS_PER_INSTANCE: 6,
      TOPOLOGY: 'triangle-list',
      BLEND_STATE: MAX_BLEND,
    })

    const stepLine = slangPass({ id: 'step', mod, blendState: SRC_OVER })
    const centerLine = slangPass({ id: 'center', mod })

    expect(stepLine.blendState).toEqual(SRC_OVER)
    expect(centerLine.blendState).toEqual(MAX_BLEND)
    expect(
      slangPass({ id: 'strip', mod, topology: 'triangle-strip' }).topology,
    ).toBe('triangle-strip')
  })

  it('forwards the reflected binding table and the module textures', () => {
    // `bindings` is the shader's own answer, and the parity gate reads it rather
    // than a hardcoded index — so dropping it here would quietly re-open the
    // three-places-asserted-by-hand problem it was added to close.
    const textures: [TextureBinding] = [
      {
        textureBinding: 2,
        samplerBinding: 3,
        glTextureUnit: 0,
        glUniformName: 'u_colorRamp',
        filter: 'linear',
      },
    ]
    const bindings = [
      { index: 1, kind: 'uniform' as const, name: 'u' },
      { index: 2, kind: 'texture' as const, name: 'ramp' },
    ]

    const desc = slangPass({
      id: 'hic',
      mod: shaderModule({
        VERTS_PER_INSTANCE: 6,
        TEXTURES: textures,
        BINDINGS: bindings,
      }),
    })

    expect(desc.textures).toEqual(textures)
    expect(desc.bindings).toEqual(bindings)
  })

  it('takes an explicit blend over the module default', () => {
    const desc = slangPass({
      id: 'outline',
      mod: shaderModule({ VERTS_PER_INSTANCE: 6 }),
      blend: false,
    })

    expect(desc.blend).toBe(false)
  })
})
