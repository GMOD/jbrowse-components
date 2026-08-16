// SNP coverage pass: segments stacked on the coverage bars showing A/C/G/T/N
// fraction per bin. colorType encodes 1=A 2=C 3=G 4=T 5=N.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/snpCoverageLayout.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// yOffset/segHeight are fractions of THIS position's coverage bar (not regional).
// relDepth = totalDepthAtPos / regionMaxDepth feeds the bar-height calculation
// via normalizeDepth, so each segment is a linear slice of a possibly-log-scaled
// bar without any per-position un-mixing at draw time.
//
// Which means that on a LOG axis the coloured fraction reads as the allele
// proportion and not as a count off the y-axis: a 50% allele is half the bar
// whatever the scale, so its top edge does not land on the depth the axis would
// read there. Deliberate — the alternative bakes the axis into the buffer and
// needs a repack on every autoscale change — and written down in
// reference/DEEP_COVERAGE.md, because the two readings differ.
struct Instance {
  uint  position   : ATTR0;
  float yOffset    : ATTR1;
  float segHeight  : ATTR2;
  float colorType  : ATTR3;
  float relDepth   : ATTR4;
};

float3 snpColor(float ct, Uniforms u) {
  // 5=N and any other type hit `default` and use the dedicated N color.
  switch (int(ct)) {
    case 1:  return unpackRGBA(u.colorBaseA).xyz;
    case 2:  return unpackRGBA(u.colorBaseC).xyz;
    case 3:  return unpackRGBA(u.colorBaseG).xyz;
    case 4:  return unpackRGBA(u.colorBaseT).xyz;
    default: return unpackRGBA(u.colorBaseN).xyz;
  }
}

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  // The allele-fraction floor. `segHeight` IS this allele's share of the
  // position's depth, so the test is the setting with no conversion. Folding
  // the vertex rather than shrinking the segment is what leaves the stack above
  // it where it was: the grey depth bar underneath is ungated, so the hidden
  // slice reads as reference. Canvas2D's `drawSnpSegments` runs the same test.
  if (inst.segHeight < u.snpMinFreq) {
    return discardVertex();
  }
  ColorVsOut o;
  o.position = covSegQuad(inst.position, 1u, inst.yOffset, inst.segHeight,
                          inst.relDepth, quadLocal(vid), u);
  o.color = float4(snpColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
