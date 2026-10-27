// Uniforms for the five LGV feature-glyph passes in this directory (rect, line,
// chevron, arrow, continuation). Every pass binds them at binding(1,0), so a
// renderer writes them once per block.
module featureGlyphUniforms;

import hpmath;

public struct FeatureGlyphUniforms {
  // [bpStartHi, bpStartLo, ±clippedLengthBp]; a reversed block negates the
  // length, which flips clip x. See blockClipUtils.ts.
  public float3 bpRangeX;
  public float  canvasHeight;
  // The block's scissored width, not the canvas's: clip x = ±1 spans it, so
  // every px↔clip conversion measures against it. `canvasEdgeFlags` reads the
  // true canvas width on the CPU and passes down left/rightIsCanvasEdge.
  public float  canvasWidth;
  public float  scrollY;
  public float  bpPerPx;
  // Precision-barrier sentinel for hpmath; see hpmath.slang.
  public float  zero;
  // 0 forward, 1 reversed; a float so `flipX` can lerp.
  public float  reversed;
  public uint   outlineColor;
  // 1.0 where the block's edge is the canvas edge rather than a seam between
  // displayedRegions. Only the continuation pass reads them.
  public float  leftIsCanvasEdge;
  public float  rightIsCanvasEdge;
};

// Call these rather than hpToClipX(hpSplitUint(...), u.bpRangeX, u.zero);
// alignmentsUniforms.slang has the same wrappers.
public float bpToClipX(uint bp, FeatureGlyphUniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}
public float hpClipX(float2 splitPos, FeatureGlyphUniforms u) {
  return hpToClipX(splitPos, u.bpRangeX, u.zero);
}
// bp from a split position to this block's viewport start.
public float hpOffsetBp(float2 splitPos, FeatureGlyphUniforms u) {
  return hpViewportOffsetBp(splitPos, u.bpRangeX, u.zero);
}
public float pxToClipW(float px, FeatureGlyphUniforms u) {
  return pxToClipLen(px, u.canvasWidth);
}
public float pxToClipH(float px, FeatureGlyphUniforms u) {
  return pxToClipLen(px, u.canvasHeight);
}
// Negates `x` on a reversed block, whether a clip position or a ±1 direction.
public float flipX(float x, FeatureGlyphUniforms u) {
  return lerp(x, -x, u.reversed);
}
