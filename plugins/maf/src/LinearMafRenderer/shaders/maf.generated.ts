// AUTO-GENERATED from maf.slang. Run `pnpm gen:shaders` to regenerate.
// Hand-authored initial version — regenerate after slang tooling is set up.

import type { GlAttributeLayout } from '@jbrowse/core/gpu/hal'

export const WGSL_SOURCE =
  "struct Uniforms_std140_0\n" +
  "{\n" +
  "    @align(16) bpRangeX_0 : vec3<f32>,\n" +
  "    @align(4) canvasHeight_0 : f32,\n" +
  "    @align(16) viewportWidth_0 : f32,\n" +
  "    @align(4) reversed_0 : f32,\n" +
  "    @align(8) zero_0 : f32,\n" +
  "    @align(4) rowHeight_0 : f32,\n" +
  "    @align(4) rowProportion_0 : f32,\n" +
  "};\n" +
  "@binding(1) @group(0) var<uniform> u_0 : Uniforms_std140_0;\n" +
  "\n" +
  "fn hpSplitUint_0(value_0 : u32) -> vec2<f32> {\n" +
  "    var lo_0 : u32 = (value_0 & u32(4095));\n" +
  "    return vec2<f32>(f32(value_0 - lo_0), f32(lo_0));\n" +
  "}\n" +
  "fn hpToClipX_0(splitPos_0 : vec2<f32>, bpRange_0 : vec3<f32>, hpZero_0 : f32) -> f32 {\n" +
  "    var step_0 : f32 = 2.0 / bpRange_0.z;\n" +
  "    var _S1 : f32 = -(1.0 / hpZero_0);\n" +
  "    return dot(vec3<f32>(-1.0, max(splitPos_0.x - bpRange_0.x, _S1), max(splitPos_0.y - bpRange_0.y, _S1)), vec3<f32>(1.0, step_0, step_0));\n" +
  "}\n" +
  "fn yPxToClipY_0(yPx_0 : f32, canvasH_0 : f32) -> f32 { return 1.0 - (yPx_0 / canvasH_0) * 2.0; }\n" +
  "fn quadLocal_0(vid_0 : u32) -> vec2<f32> {\n" +
  "    var v_0 : u32 = vid_0 % u32(6);\n" +
  "    var _S2 : bool = v_0 == u32(0);\n" +
  "    var _S3 : bool; if(_S2) { _S3 = true; } else { _S3 = v_0 == u32(2); }\n" +
  "    if(_S3) { _S3 = true; } else { _S3 = v_0 == u32(3); }\n" +
  "    var _S4 : f32; if(_S3) { _S4 = 0.0; } else { _S4 = 1.0; }\n" +
  "    if(_S2) { _S3 = true; } else { _S3 = v_0 == u32(1); }\n" +
  "    if(_S3) { _S3 = true; } else { _S3 = v_0 == u32(4); }\n" +
  "    var _S5 : f32; if(_S3) { _S5 = 0.0; } else { _S5 = 1.0; }\n" +
  "    return vec2<f32>(_S4, _S5);\n" +
  "}\n" +
  "fn unpackRGBA_0(c_0 : u32) -> vec4<f32> {\n" +
  "    return vec4<f32>(f32(c_0 & u32(255)), f32((c_0 >> u32(8)) & u32(255)), f32((c_0 >> u32(16)) & u32(255)), f32((c_0 >> u32(24)) & u32(255))) / 255.0;\n" +
  "}\n" +
  "struct VsOut_0 { @builtin(position) position_0 : vec4<f32>, @location(0) color_0 : vec4<f32>, };\n" +
  "struct vertexInput_0 { @location(0) startBp_0 : u32, @location(1) endBp_0 : u32, @location(2) rowIndex_0 : u32, @location(3) color_1 : u32, };\n" +
  "@vertex\n" +
  "fn vs_main(_S6 : vertexInput_0, @builtin(vertex_index) vid_1 : u32) -> VsOut_0 {\n" +
  "    var local_0 : vec2<f32> = quadLocal_0(vid_1);\n" +
  "    var h_0 : f32 = u_0.rowHeight_0 * u_0.rowProportion_0;\n" +
  "    var offset_0 : f32 = (u_0.rowHeight_0 - h_0) * 0.5;\n" +
  "    var rowY_0 : f32 = offset_0 + u_0.rowHeight_0 * f32(_S6.rowIndex_0);\n" +
  "    var startSplit_0 : vec2<f32> = hpSplitUint_0(_S6.startBp_0);\n" +
  "    var endSplit_0 : vec2<f32> = hpSplitUint_0(_S6.endBp_0);\n" +
  "    var sx1_0 : f32 = hpToClipX_0(startSplit_0, u_0.bpRangeX_0, u_0.zero_0);\n" +
  "    var sx2_0 : f32 = hpToClipX_0(endSplit_0, u_0.bpRangeX_0, u_0.zero_0);\n" +
  "    var minClipW_0 : f32 = 1.0 / u_0.viewportWidth_0 * 2.0;\n" +
  "    var sx2_1 : f32; if((sx2_0 - sx1_0) < minClipW_0) { sx2_1 = sx1_0 + minClipW_0; } else { sx2_1 = sx2_0; }\n" +
  "    var clipX_0 : f32 = mix(sx1_0, sx2_1, local_0.x);\n" +
  "    clipX_0 = mix(clipX_0, -clipX_0, u_0.reversed_0);\n" +
  "    var yPx_0 : f32 = mix(rowY_0, rowY_0 + h_0, local_0.y);\n" +
  "    var clipY_0 : f32 = yPxToClipY_0(yPx_0, u_0.canvasHeight_0);\n" +
  "    var o_0 : VsOut_0;\n" +
  "    o_0.position_0 = vec4<f32>(clipX_0, clipY_0, 0.0, 1.0);\n" +
  "    o_0.color_0 = unpackRGBA_0(_S6.color_1);\n" +
  "    return o_0;\n" +
  "}\n" +
  "struct pixelInput_0 { @location(0) color_2 : vec4<f32>, };\n" +
  "struct pixelOutput_0 { @location(0) output_0 : vec4<f32>, };\n" +
  "@fragment\n" +
  "fn fs_main(_S7 : pixelInput_0) -> pixelOutput_0 { return pixelOutput_0(_S7.color_2); }\n"

export const GLSL_VERTEX =
  "#version 300 es\n" +
  "precision highp float;\n" +
  "precision highp int;\n" +
  "layout(std140) uniform Uniforms {\n" +
  "    vec3 bpRangeX_0; float canvasHeight_0;\n" +
  "    float viewportWidth_0; float reversed_0; float zero_0;\n" +
  "    float rowHeight_0; float rowProportion_0;\n" +
  "} u_0;\n" +
  "vec2 hpSplitUint_0(uint value_0) { uint lo_0 = value_0 & 4095U; return vec2(float(value_0 - lo_0), float(lo_0)); }\n" +
  "float hpToClipX_0(vec2 splitPos_0, vec3 bpRange_0, float hpZero_0) {\n" +
  "    float step_0 = 2.0 / bpRange_0.z; float _S1 = -(1.0 / hpZero_0);\n" +
  "    return dot(vec3(-1.0, max(splitPos_0.x - bpRange_0.x, _S1), max(splitPos_0.y - bpRange_0.y, _S1)), vec3(1.0, step_0, step_0)); }\n" +
  "float yPxToClipY_0(float yPx_0, float canvasH_0) { return 1.0 - (yPx_0 / canvasH_0) * 2.0; }\n" +
  "vec2 quadLocal_0(uint vid_0) {\n" +
  "    uint v_0 = vid_0 % 6U; bool _S2 = v_0 == 0U; bool _S3;\n" +
  "    if(_S2) { _S3 = true; } else { _S3 = v_0 == 2U; }\n" +
  "    if(_S3) { _S3 = true; } else { _S3 = v_0 == 3U; }\n" +
  "    float _S4; if(_S3) { _S4 = 0.0; } else { _S4 = 1.0; }\n" +
  "    if(_S2) { _S3 = true; } else { _S3 = v_0 == 1U; }\n" +
  "    if(_S3) { _S3 = true; } else { _S3 = v_0 == 4U; }\n" +
  "    float _S5; if(_S3) { _S5 = 0.0; } else { _S5 = 1.0; }\n" +
  "    return vec2(_S4, _S5); }\n" +
  "vec4 unpackRGBA_0(uint c_0) { return vec4(float(c_0 & 255U), float((c_0 >> 8U) & 255U), float((c_0 >> 16U) & 255U), float((c_0 >> 24U) & 255U)) / 255.0; }\n" +
  "out vec4 v_color;\n" +
  "layout(location = 0) in uint a_startBp;\n" +
  "layout(location = 1) in uint a_endBp;\n" +
  "layout(location = 2) in uint a_rowIndex;\n" +
  "layout(location = 3) in uint a_color;\n" +
  "void main() {\n" +
  "    vec2 local_0 = quadLocal_0(uint(gl_VertexID));\n" +
  "    float h_0 = u_0.rowHeight_0 * u_0.rowProportion_0;\n" +
  "    float offset_0 = (u_0.rowHeight_0 - h_0) * 0.5;\n" +
  "    float rowY_0 = offset_0 + u_0.rowHeight_0 * float(a_rowIndex);\n" +
  "    vec2 startSplit_0 = hpSplitUint_0(a_startBp);\n" +
  "    vec2 endSplit_0 = hpSplitUint_0(a_endBp);\n" +
  "    float sx1_0 = hpToClipX_0(startSplit_0, u_0.bpRangeX_0, u_0.zero_0);\n" +
  "    float sx2_0 = hpToClipX_0(endSplit_0, u_0.bpRangeX_0, u_0.zero_0);\n" +
  "    float minClipW_0 = 1.0 / u_0.viewportWidth_0 * 2.0;\n" +
  "    float sx2_1; if((sx2_0 - sx1_0) < minClipW_0) { sx2_1 = sx1_0 + minClipW_0; } else { sx2_1 = sx2_0; }\n" +
  "    float clipX_0 = mix(sx1_0, sx2_1, local_0.x);\n" +
  "    clipX_0 = mix(clipX_0, -clipX_0, u_0.reversed_0);\n" +
  "    float yPx_0 = mix(rowY_0, rowY_0 + h_0, local_0.y);\n" +
  "    float clipY_0 = yPxToClipY_0(yPx_0, u_0.canvasHeight_0);\n" +
  "    gl_Position = vec4(clipX_0, clipY_0, 0.0, 1.0);\n" +
  "    v_color = unpackRGBA_0(a_color);\n" +
  "}\n"

export const GLSL_FRAGMENT =
  "#version 300 es\n" +
  "precision highp float;\n" +
  "precision highp int;\n" +
  "layout(location = 0) out vec4 entryPointParam_fs_main_0;\n" +
  "in vec4 v_color;\n" +
  "void main() { entryPointParam_fs_main_0 = v_color; }\n"

export const VERTS_PER_INSTANCE = 6

// Uniform buffer layout (std140, 48 bytes):
//   bpRangeX      vec3<f32>  bytes  0-11  f32[0,1,2]
//   canvasHeight  f32        bytes 12-15  f32[3]   (packed with vec3)
//   viewportWidth f32        bytes 16-19  f32[4]
//   reversed      f32        bytes 20-23  f32[5]
//   zero          f32        bytes 24-27  f32[6]
//   rowHeight     f32        bytes 28-31  f32[7]
//   rowProportion f32        bytes 32-35  f32[8]
//   padding                  bytes 36-47
export const UNIFORMS_SIZE_BYTES = 48
export const UNIFORMS_SIZE_F32 = 12

export const UNIFORM_OFFSET_BYTES = {
  bpRangeX: 0,
  canvasHeight: 12,
  viewportWidth: 16,
  reversed: 20,
  zero: 24,
  rowHeight: 28,
  rowProportion: 32,
} as const

export const UNIFORM_OFFSET_F32 = {
  bpRangeX: 0,
  canvasHeight: 3,
  viewportWidth: 4,
  reversed: 5,
  zero: 6,
  rowHeight: 7,
  rowProportion: 8,
} as const

// Instance layout: [startBp(u32), endBp(u32), rowIndex(u32), color(u32)]
// 16 bytes per instance — compact, all uint32, zero-copy transferable.
export const INSTANCE_STRIDE_BYTES = 16
export const INSTANCE_STRIDE_U32 = 4

export const FIELD_OFFSET_BYTES = {
  startBp: 0,
  endBp: 4,
  rowIndex: 8,
  color: 12,
} as const

export const GL_ATTRIBUTES: readonly GlAttributeLayout[] = [
  { name: 'a_startBp',  components: 1, type: 'uint', offsetBytes: 0,  integer: true },
  { name: 'a_endBp',    components: 1, type: 'uint', offsetBytes: 4,  integer: true },
  { name: 'a_rowIndex', components: 1, type: 'uint', offsetBytes: 8,  integer: true },
  { name: 'a_color',    components: 1, type: 'uint', offsetBytes: 12, integer: true },
]
