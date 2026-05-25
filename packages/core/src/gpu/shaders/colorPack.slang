// Shared color-packing helpers. A single `uint` holds an ABGR triplet as
// packed bytes, letting every shader carry color data as one vertex
// attribute instead of four floats. Pair with `cssColorToABGR` on the
// CPU side (see packages/core/src/util/colorBits.ts).
module colorPack;

public float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}
