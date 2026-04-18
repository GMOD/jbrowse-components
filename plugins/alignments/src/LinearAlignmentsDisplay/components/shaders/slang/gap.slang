// Gap pass: deletion (rect) or skip (1px centerline) per CIGAR D/N op.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;

static const uint GAP_DELETION = 0u;
static const uint GAP_SKIP     = 1u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  startOff  : ATTR0;
  uint  endOff    : ATTR1;
  uint  y         : ATTR2;
  uint  gapType   : ATTR3;  // 0 = deletion, 1 = skip
  float frequency : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float domLen = cigarDomainLen(u);
  float2 dom = cigarDomain(u);
  float sx1 = (float(inst.startOff) - dom.x) / domLen * 2.0 - 1.0;
  float sx2 = (float(inst.endOff) - dom.x) / domLen * 2.0 - 1.0;

  float2 yy = pileupY(float(inst.y), u);
  float yTop = yy.x;
  float yBot = yy.y;

  if (inst.gapType == GAP_SKIP) {
    // Collapse to a 1px centerline for introns / skipped regions.
    float mid = (yTop + yBot) * 0.5;
    float onePx = 2.0 / u.canvasH;
    yTop = mid;
    yBot = mid - onePx;
  }

  float alpha = 1.0;
  if (inst.gapType == GAP_DELETION) {
    float widthPx = float(inst.endOff - inst.startOff) * u.canvasW / domLen;
    if (widthPx < 1.0) {
      float base = widthPx * widthPx;
      alpha = base + inst.frequency * (1.0 - base);
    }
  }
  if (alpha <= 0.0) {
    o.position = float4(0.0);
    o.color = float4(0.0);
    return o;
  }

  float sx = lerp(sx1, sx2, local.x);
  float sy = lerp(yBot, yTop, local.y);
  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  float3 c = (inst.gapType == GAP_DELETION) ? unpackRGBA(u.colorDeletion).xyz : unpackRGBA(u.colorSkip).xyz;
  o.color = float4(c, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
