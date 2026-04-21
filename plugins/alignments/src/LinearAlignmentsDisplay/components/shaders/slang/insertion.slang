// Insertion pass: renders up to 3 rects per instance — the insertion bar
// (or numeric label box when long + zoomed), plus top/bottom serifs. Vertex
// count is 18 (3 rects * 6 verts).
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;

// SYNC(@jbrowse/alignments-core labelConstants.ts)
static const uint  LONG_INSERTION_MIN_LENGTH = 10u;
static const float LONG_INSERTION_TEXT_THRESHOLD_PX = 15.0;
static const float INSERTION_SERIF_MIN_PX_PER_BP = 3.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  uint  y         : ATTR1;
  uint  length    : ATTR2;
  float frequency : ATTR3;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

// SYNC(labelConstants.ts:textWidthForNumber)
float textWidth(uint num) {
  float cw = 6.0;
  float pad = 10.0;
  if (num < 10u)    { return cw + pad; }
  if (num < 100u)   { return cw * 2.0 + pad; }
  if (num < 1000u)  { return cw * 3.0 + pad; }
  if (num < 10000u) { return cw * 4.0 + pad; }
  return cw * 5.0 + pad;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  uint rectIdx = vid / 6u;
  float2 local = quadLocal(vid);

  float pxPerBp = u.canvasW / u.bpLen;
  float cx = hpClipX(hpSplitUint(inst.position), u);

  bool isLong = inst.length >= LONG_INSERTION_MIN_LENGTH;
  float insWPx = float(inst.length) * pxPerBp;
  bool canText = insWPx >= LONG_INSERTION_TEXT_THRESHOLD_PX;
  bool isLarge = isLong && canText;

  float rectW;
  if (isLarge)      { rectW = textWidth(inst.length); }
  else if (isLong)  { rectW = min(5.0, insWPx / 3.0); }
  else              { rectW = 1.0; }

  float onePx = 2.0 / u.canvasW;
  float rectWClip = rectW * 2.0 / u.canvasW;
  float tickWClip = onePx * 3.0;

  float2 yy = pileupY(float(inst.y), u);
  float syTop = yy.x;
  float syBot = yy.y;

  float x1, x2, y1, y2;
  if (rectIdx == 0u) {
    x1 = cx - rectWClip * 0.5;
    x2 = cx + rectWClip * 0.5;
    y1 = syBot;
    y2 = syTop;
  } else if (rectIdx == 1u) {
    if (isLong || pxPerBp < INSERTION_SERIF_MIN_PX_PER_BP) {
      x1 = cx; x2 = cx; y1 = syTop; y2 = syTop;  // degenerate
    } else {
      x1 = cx - tickWClip * 0.5;
      x2 = cx + tickWClip * 0.5;
      float th = 2.0 / u.canvasH;
      y1 = syTop; y2 = syTop + th;
    }
  } else {
    if (isLong || pxPerBp < INSERTION_SERIF_MIN_PX_PER_BP) {
      x1 = cx; x2 = cx; y1 = syBot; y2 = syBot;
    } else {
      x1 = cx - tickWClip * 0.5;
      x2 = cx + tickWClip * 0.5;
      float th = 2.0 / u.canvasH;
      y1 = syBot - th; y2 = syBot;
    }
  }

  float sx = lerp(x1, x2, local.x);
  float sy = lerp(y1, y2, local.y);

  float alpha = 1.0;
  if (!isLong && pxPerBp < 1.0) {
    float base = pxPerBp * pxPerBp;
    alpha = base + inst.frequency * (1.0 - base);
  }
  if (alpha <= 0.0) {
    o.position = float4(0.0);
    o.color = float4(0.0);
    return o;
  }

  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  o.color = float4(unpackRGBA(u.colorInsertion).xyz, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
