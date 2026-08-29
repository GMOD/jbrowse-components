// The wiggle renderer's xyplot and scatter renderings, branched on the
// `renderingType` uniform. Its siblings: `wiggleLine.slang` draws the stroked
// renderings (line, linecenter) off a wider record, and `wiggleDensity.slang`
// draws density off this same fill buffer by composing the shared `rowRect`
// shape. All three import `wiggleCommon` for the uniform block and the score
// math. Bound to PASS_FILL, which draws 6-vert quads.
//
// Neither rendering here reads a neighbouring feature, which is why the
// instance record (`WiggleFillInstance`, declared in wiggleCommon so the
// density entry point can share the buffer) is the five words it is: while all
// five renderings shared this shader every fill buffer also carried the
// step-line's prevScore/nextScore and the center-line's
// prevStartEnd/prevScoreLine — 20 bytes per feature that no fill pass reads,
// and tens of MB of a 1000-source multiwiggle's single per-region allocation.
//! targets: wgsl, glsl

import antialias;
import hpmath;
import colorPack;
import pointGlyph;
import wiggleCommon;


public static const uint VERTS_PER_INSTANCE = 6u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // scatter: local quad coord (-1..1) for disc AA.
  float2 localPos : TEXCOORD0;
  // xyplot: CSS px below the bar's top cut (.x) and below its bottom cut (.y).
  // Both are affine in screen y with unit slope — the vertex sets them from the
  // same `vy` it converts to clip — so the fragment's ramp is one OUTPUT pixel
  // wide by construction and takes no derivative. Same shape as
  // syntenyTypes.slang's `vertCoverage`, which is where the band-as-a-difference
  // -of-two-ramps form is written up.
  float2 barInkPx : TEXCOORD1;
};

// Which glyph the pass draws follows entirely from uniforms, so both stages
// derive it instead of passing a discriminator varying. That also keeps the
// fragment's branch in UNIFORM control flow, which WGSL requires around the
// derivatives it takes (a branch on a varying is rejected outright).
//
// Point-like scatter features become an AA disc; tiny ones a crisp square, like
// manhattan.slang. SMALL_POINT_MAX_DIAMETER and the disc SDF live in the shared
// pointGlyph module so the two stay in lockstep.
bool drawsDisc() {
  return u.renderingType == RENDERING_TYPE_SCATTER
    && u.scatterPointSize > SMALL_POINT_MAX_DIAMETER;
}

// Whether this pass draws the xyplot bar, whose two HORIZONTAL cuts the shader
// antialiases itself. Uniform for the same reason drawsDisc() is.
bool drawsBar() {
  return u.renderingType == RENDERING_TYPE_XYPLOT;
}

// One device pixel, in the CSS px the bar geometry is measured in. It is both
// the ramp's full width and the geometry pad, and it has to be both: the pad
// makes every fragment the ramp gives ink to fully covered by the quad, so the
// rasterizer's own coverage never multiplies into the analytic one and the bar
// looks the same at 1 sample as at 4.
float barAaPx() {
  return 2.0 * aaHalfPx(u.devicePixelRatio);
}


[shader("vertex")]
VsOut vs_main(WiggleFillInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.startEnd.x, u);
  float sx2 = bpToClipX(inst.startEnd.y, u);

  float rowHeight = u.canvasHeight / u.numRows;
  float rowTop = inst.rowIndex * rowHeight;
  float pxToClip = 2.0 / u.canvasHeight;

  float sx;
  float sy;
  float2 localPos = float2(0.0, 0.0);
  float2 barInkPx = float2(0.0, 0.0);

  if (u.renderingType == RENDERING_TYPE_SCATTER) {
    // Point plot: every feature is a point marker centered on the bp midpoint,
    // never a bar (unlike manhattan.slang, which bars wide bins). scatterPointSize
    // is the disc diameter; tiny points draw as a crisp square like manhattan.
    float midX = (sx1 + sx2) * 0.5;
    float scoreYPx = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant) + rowTop;
    float2 q = quadLocal(vid);
    if (drawsDisc()) {
      // expand the quad by the AA pad so the disc's fade edge isn't clipped
      float radiusPx = u.scatterPointSize * 0.5;
      float2 local = q * 2.0 - float2(1.0, 1.0);
      float expand = discExpand(radiusPx, u.devicePixelRatio);
      float halfPx = radiusPx * expand;
      sx = midX + pxToClipLen(local.x * halfPx, u.viewportWidth);
      sy = (1.0 - scoreYPx * pxToClip) + local.y * halfPx * pxToClip;
      localPos = local * expand;
    } else {
      // tiny point: pixel-snapped crisp filled square, no AA disc
      float4 p = crispSquareCornerClip(midX, scoreYPx, u.scatterPointSize, q,
                                       u.viewportWidth, u.canvasHeight);
      sx = p.x;
      sy = p.y;
    }
  } else {
    // The min-width floor, anchored at the bin's start so it grows the way the
    // Canvas2D `spanLeft` twin does. `u.viewportWidth` is CSS px (see
    // GpuWiggleRenderer), which is what makes the floor the same 1.5 CSS px at
    // every dpr rather than 1.5 device px.
    sx2 = extendToMinWidthX(sx1, sx2, MIN_FILL_WIDTH_PX, u.viewportWidth);
    float2 q = quadLocal(vid);
    sx = lerp(sx1, sx2, q.x);

    float scoreY  = scoreToY(inst.score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant);
    float originY = scoreToY(u.origin,   u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant);
    float topPx = min(scoreY, originY) + rowTop;
    float botPx = max(scoreY, originY) + rowTop;
    // The bar grows one device px past each horizontal cut so the fragment's
    // ramp has geometry to land on; the ramp is zero out there, so the extra
    // area costs a discarded fragment and paints nothing.
    float padPx = barAaPx();
    float vy = lerp(botPx + padPx, topPx - padPx, q.y);
    sy = 1.0 - vy * pxToClip;
    barInkPx = float2(vy - topPx, vy - botPx);
  }

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = float4(unpackRGBA(inst.color).rgb, 1.0);
  o.localPos = localPos;
  o.barInkPx = barInkPx;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float4 outColor;
  if (drawsDisc()) {
    float alpha = discAlpha(fragIn.localPos);
    if (alpha <= 0.0) {
      discard;
    }
    outColor = float4(fragIn.color.rgb, fragIn.color.a * alpha);
  } else if (drawsBar()) {
    // A bar's top cut IS the datum, so it must not quantise to the output grid:
    // the reader takes the score off that edge, and rounding it to a whole
    // device pixel rounds the value. The band is the difference of the two
    // cuts' coverages, which is exactly the area the bar covers of the pixel at
    // every height — including under one device px, where a single ramp applies
    // a half-plane formula to a slab and over-inks (a bar sitting exactly on the
    // origin would paint a half-covered row where it owes none).
    //
    // The VERTICAL cuts stay hard on purpose. Bins tile, so two neighbours split
    // one pixel column, and per-fragment alpha on both sides of that shared edge
    // composites to less than full ink — the seam GPU_RENDERING.md refuses for
    // hi-C.
    //
    // The horizontal cuts conflate too, and the bound is worth knowing rather
    // than claiming away: `extendToMinWidthX` above floors a bin at
    // MIN_FILL_WIDTH_PX by growing it off its anchor, so at any zoom whose bin
    // is under 1.5 CSS px a bar OVERLAPS its neighbours and a column carries two
    // or three of them. Where their tops agree — a flat run, a plateau — the
    // fringe row composites 1-(1-a)^n instead of a, up to 0.375 too much ink at
    // n=3. It reads as a top edge a third of a device pixel too tall on flat
    // stretches, against the 0.277 of MSAA quantisation this replaces
    // everywhere, so the trade is worth taking and is not worth hiding.
    // barCutCoverage.test.ts pins it.
    float aaPx = barAaPx();
    float alpha = aaRamp(fragIn.barInkPx.x, aaPx) - aaRamp(fragIn.barInkPx.y, aaPx);
    if (alpha <= 0.0) {
      discard;
    }
    outColor = float4(fragIn.color.rgb, fragIn.color.a * alpha);
  } else {
    // The crisp small-point square is a flat fill whose edges are meant to be
    // hard — pixel-snapped by the vertex stage.
    outColor = fragIn.color;
  }
  return outColor;
}
