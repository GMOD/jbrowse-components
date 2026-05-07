// Read pass: one 9-vertex "quad + optional chevron cap" per alignment
// segment. Verts 0..5 draw the body rectangle; 6..8 draw a chevron tip
// clipped to the segment's leading (fwd) or trailing (rev) edge.
//
// highlightOnly=1 mode draws a translucent dark overlay across the full
// read span (mate-to-mate) for feature/selection highlighting.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 9u;
// Color scheme constants — SYNC(rendererTypes.ts colorScheme enum)
static const int CS_NORMAL        = 0;
static const int CS_STRAND        = 1;
static const int CS_MAPQ          = 2;
static const int CS_INSERT_SIZE   = 3;
static const int CS_FIRST_OF_PAIR = 4;
static const int CS_PAIR_ORIENT   = 5;
static const int CS_IS_AND_ORIENT = 6;
static const int CS_MODIFICATIONS = 7;
static const int CS_TAG           = 8;
static const int CS_BASE_QUALITY  = 9;
static const int CS_IS_GRADIENT   = 10;

static const int CM_LINKED_READ = 1;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  startOff       : ATTR0;   // absolute genomic bp
  uint  endOff         : ATTR1;   // absolute genomic bp
  uint  y              : ATTR2;
  uint  flags          : ATTR3;
  uint  mapq           : ATTR4;
  uint  baseQuality    : ATTR5;
  float insertSize     : ATTR6;
  uint  pairOrient     : ATTR7;
  int   strand         : ATTR8;
  uint  tagColor       : ATTR9;   // ABGR u32; 0 = not set
  uint  chainHasSupp   : ATTR10;  // 0=no supp, 1=supp + primary fwd, 2=supp + primary rev
  uint  readIndex      : ATTR11;
  uint  edgeFlags      : ATTR12;  // bit 0 = is_first, bit 1 = is_last
  uint  readStartOff   : ATTR13;  // full-read-span start absolute bp (for highlight overlay)
  uint  readEndOff     : ATTR14;  // absolute bp
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : COLOR1;
  float2 featSize : COLOR2;
  float  edgeFlag : COLOR3;
};

// --- color-scheme helpers ---

float3 strandColor(int s, Uniforms u) {
  if (s > 0) { return unpackRGBA(u.colorFwd).xyz; }
  if (s < 0) { return unpackRGBA(u.colorRev).xyz; }
  return unpackRGBA(u.colorNostrand).xyz;
}

float3 mapqColor(uint mapq) {
  float h = float(mapq) / 360.0;
  float c = 0.5;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(hp % 2.0 - 1.0));
  float m = 0.25;
  float3 hue;
  if (hp < 1.0)      { hue = float3(c, x, 0.0); }
  else if (hp < 2.0) { hue = float3(x, c, 0.0); }
  else if (hp < 3.0) { hue = float3(0.0, c, x); }
  else if (hp < 4.0) { hue = float3(0.0, x, c); }
  else if (hp < 5.0) { hue = float3(x, 0.0, c); }
  else               { hue = float3(c, 0.0, x); }
  return hue + m;
}

float3 insertSizeColor(float is, Uniforms u) {
  if (is > u.insertUpper) { return unpackRGBA(u.colorLongInsert).xyz; }
  if (is < u.insertLower) { return unpackRGBA(u.colorShortInsert).xyz; }
  return unpackRGBA(u.colorPairLR).xyz;
}

float3 insertSizeGradientColor(float is, Uniforms u) {
  float3 base = unpackRGBA(u.colorPairLR).xyz;
  if (is > u.insertUpper) {
    float t = clamp((is - u.insertUpper) / u.insertUpper, 0.0, 1.0);
    return lerp(base, unpackRGBA(u.colorLongInsert).xyz, t);
  }
  if (is < u.insertLower) {
    float t = clamp((u.insertLower - is) / u.insertLower, 0.0, 1.0);
    return lerp(base, unpackRGBA(u.colorShortInsert).xyz, t);
  }
  return base;
}

float3 firstOfPairColor(uint flags, int s, Uniforms u) {
  bool isFirst = (flags & 64u) != 0u;
  int eff = isFirst ? s : -s;
  return strandColor(eff, u);
}

float3 pairOrientColor(uint po, Uniforms u) {
  if (po == 1u) { return unpackRGBA(u.colorPairLR).xyz; }
  if (po == 2u) { return unpackRGBA(u.colorPairRL).xyz; }
  if (po == 3u) { return unpackRGBA(u.colorPairRR).xyz; }
  if (po == 4u) { return unpackRGBA(u.colorPairLL).xyz; }
  return unpackRGBA(u.colorNostrand).xyz;
}

float3 isAndOrientColor(float is, uint po, Uniforms u) {
  if (po == 2u) { return unpackRGBA(u.colorPairRL).xyz; }
  if (po == 3u) { return unpackRGBA(u.colorPairRR).xyz; }
  if (po == 4u) { return unpackRGBA(u.colorPairLL).xyz; }
  return insertSizeColor(is, u);
}

float3 modificationsColor(uint flags, Uniforms u) {
  if ((flags & 16u) != 0u) { return unpackRGBA(u.colorModRev).xyz; }
  return unpackRGBA(u.colorModFwd).xyz;
}

bool isOrientationScheme(int cs) {
  return cs == CS_INSERT_SIZE || cs == CS_PAIR_ORIENT
      || cs == CS_IS_AND_ORIENT || cs == CS_IS_GRADIENT;
}

float3 getReadColor(Instance inst, Uniforms u) {
  int cs = u.colorScheme;
  int cm = u.chainMode;
  bool isPaired = (inst.flags & 1u) != 0u;

  // Linked-read overrides: supplementary colored distinctly, or strand
  // flipped to match primary.
  if (cm == CM_LINKED_READ && inst.chainHasSupp > 0u && isPaired) {
    return unpackRGBA(u.colorSupplementary).xyz;
  }
  if (cm == CM_LINKED_READ && inst.chainHasSupp > 0u) {
    int primaryStrand = (inst.chainHasSupp > 1u) ? -1 : 1;
    int eff = (u.flipStrandLongRead == 1) ? inst.strand * primaryStrand : inst.strand;
    return strandColor(eff, u);
  }

  bool mateUnmapped = (inst.flags & 8u) != 0u;
  if (mateUnmapped && (isOrientationScheme(cs) || (cs == CS_NORMAL && cm == CM_LINKED_READ))) {
    return unpackRGBA(u.colorUnmappedMate).xyz;
  }

  if (cs == CS_NORMAL)        { return unpackRGBA(u.colorPairLR).xyz; }
  if (cs == CS_STRAND)        { return strandColor(inst.strand, u); }
  if (cs == CS_MAPQ)          { return mapqColor(inst.mapq); }
  if (cs == CS_INSERT_SIZE)   { return insertSizeColor(inst.insertSize, u); }
  if (cs == CS_FIRST_OF_PAIR) { return firstOfPairColor(inst.flags, inst.strand, u); }
  if (cs == CS_PAIR_ORIENT)   { return pairOrientColor(inst.pairOrient, u); }
  if (cs == CS_IS_AND_ORIENT) { return isAndOrientColor(inst.insertSize, inst.pairOrient, u); }
  if (cs == CS_MODIFICATIONS) { return modificationsColor(inst.flags, u); }
  if (cs == CS_TAG) {
    if (inst.tagColor != 0u) {
      return unpackRGBA(inst.tagColor).xyz;
    }
    return unpackRGBA(u.colorPairLR).xyz;
  }
  if (cs == CS_BASE_QUALITY) { return mapqColor(inst.baseQuality); }
  if (cs == CS_IS_GRADIENT)  { return insertSizeGradientColor(inst.insertSize, u); }
  return unpackRGBA(u.colorPairLR).xyz;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;

  if (u.highlightOnly == 1 && (u.highlightIdx < 0 || uint(u.highlightIdx) != inst.readIndex)) {
    o.position = float4(0.0);
    o.color = float4(0.0);
    o.localPos = float2(0.0);
    o.featSize = float2(0.0);
    o.edgeFlag = 0.0;
    return o;
  }

  uint v = vid % 9u;
  float sx1 = hpClipX(hpSplitUint(inst.startOff), u);
  float sx2 = hpClipX(hpSplitUint(inst.endOff), u);

  float2 yy = pileupY(float(inst.y), u);
  float syTop = yy.x;
  float syBot = yy.y;
  float syMid = (syTop + syBot) * 0.5;

  // 8px-wide chevron when featHeight>=3 and zoom supports it.
  float chevronClip = 8.0 / u.canvasW * 2.0;
  bool showChev = (u.chainMode == 1 || u.pxPerBp > 0.1) && u.featHeight >= 3.0;

  float featWPx = (sx2 - sx1) * u.canvasW * 0.5;
  o.featSize = float2(featWPx, u.featHeight);

  float sx, sy, lx, ly;
  float ef = 0.0;

  if (u.highlightOnly == 1) {
    // Overlay spans full read (incl. introns) for cross-segment highlight.
    float hlSx1 = hpClipX(hpSplitUint(inst.readStartOff), u);
    float hlSx2 = hpClipX(hpSplitUint(inst.readEndOff), u);
    lx = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
    ly = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;
    sx = lerp(hlSx1, hlSx2, lx);
    sy = lerp(syBot, syTop, ly);
    if (v >= 6u) { sx = hlSx1; sy = syTop; lx = 0.5; ly = 0.5; }
  } else if (v < 6u) {
    lx = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
    ly = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;
    sx = lerp(sx1, sx2, lx);
    sy = lerp(syBot, syTop, ly);
    bool isLast = (inst.edgeFlags & 2u) != 0u;
    bool isFirst = (inst.edgeFlags & 1u) != 0u;
    if (showChev && inst.strand > 0 && isLast)       { ef = 1.0; }
    else if (showChev && inst.strand < 0 && isFirst) { ef = -1.0; }
  } else if (showChev) {
    bool isLast = (inst.edgeFlags & 2u) != 0u;
    bool isFirst = (inst.edgeFlags & 1u) != 0u;
    bool drawFwd = inst.strand > 0 && isLast;
    bool drawRev = inst.strand < 0 && isFirst;
    ef = 2.0;
    float chevW = 8.0;
    float halfH = u.featHeight * 0.5;
    float alt = chevW * u.featHeight / sqrt(halfH * halfH + chevW * chevW);
    if (drawFwd) {
      if (v == 6u)      { sx = sx2; sy = syTop; lx = 0.0; ly = alt; }
      else if (v == 7u) { sx = sx2; sy = syBot; lx = alt; ly = 0.0; }
      else              { sx = sx2 + chevronClip; sy = syMid; lx = 0.0; ly = 0.0; }
    } else if (drawRev) {
      if (v == 6u)      { sx = sx1; sy = syTop; lx = 0.0; ly = alt; }
      else if (v == 7u) { sx = sx1 - chevronClip; sy = syMid; lx = 0.0; ly = 0.0; }
      else              { sx = sx1; sy = syBot; lx = alt; ly = 0.0; }
    } else {
      // degenerate — fold chevron verts to a single point offscreen-marker.
      lx = 999.0; ly = 999.0; sx = sx1; sy = syTop;
    }
  } else {
    lx = 0.5; ly = 0.5; sx = sx1; sy = syTop;
  }

  o.localPos = float2(lx, ly);
  o.edgeFlag = ef;
  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);

  if (u.highlightOnly == 1) {
    o.color = float4(0.0, 0.0, 0.0, 0.4);
  } else {
    o.color = float4(getReadColor(inst, u), 1.0);
  }
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (u.showStroke == 1) {
    float edgeDist;
    if (fragIn.edgeFlag > 1.5) {
      // chevron tip — distance to the two diagonal edges
      edgeDist = min(fragIn.localPos.x, fragIn.localPos.y);
    } else {
      float dxL = fragIn.localPos.x * fragIn.featSize.x;
      float dxR = (1.0 - fragIn.localPos.x) * fragIn.featSize.x;
      if (fragIn.edgeFlag > 0.5)  { dxR = 999.0; }  // hide outline on chevron side
      float dxLL = dxL;
      if (fragIn.edgeFlag < -0.5) { dxLL = 999.0; }
      float dy = min(fragIn.localPos.y, 1.0 - fragIn.localPos.y) * fragIn.featSize.y;
      edgeDist = min(min(dxLL, dxR), dy);
    }
    if (edgeDist < 1.0 && fragIn.featSize.x > 2.0 && fragIn.featSize.y > 2.0) {
      return float4(fragIn.color.rgb * 0.7, fragIn.color.a);
    }
  }
  return fragIn.color;
}
