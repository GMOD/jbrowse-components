// Shared color-packing helpers. A single `uint` holds an ABGR triplet as
// packed bytes, letting every shader carry color data as one vertex
// attribute instead of four floats. Pair with `cssColorToABGR` on the
// CPU side (see packages/core/src/util/colorBits.ts).
module colorPack;

// Don't put a SCALAR array in a uniform block and unpack it with this.
// slangc v2026.5.2's WGSL backend cannot compile it: a `uint palette[N]` member
// becomes a `_Array_std140_uintN` wrapper (std140 pads each element to 16
// bytes), and passing an element of one to a cross-module function SEGFAULTS the
// compiler — signal 11, no diagnostic. `[ForceInline]` here dodges the crash and
// then emits invalid WGSL (a bare `…data_0[i].x;` statement, which naga
// rejects), so there is no version of it that works. GLSL compiles the same
// source fine, so it is WGSL-specific.
//
// Declare such a palette as `float4[N]` instead — a vector element needs no
// wrapper struct, lowers correctly, AND costs the same 16 bytes per slot that
// std140 was padding the uint to anyway, so packing bought nothing here. Packing
// still earns its keep in VERTEX ATTRIBUTES, which is what this is for.
public float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}
