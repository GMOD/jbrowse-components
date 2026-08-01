// Shared per-instance layout + uniform block for fill/edge synteny shaders.
// Each instance is one parallelogram (or one curved ribbon strip): four corner
// positions in WINDOW-RELATIVE bp — cumBp minus a per-axis fetch-time base
// (`base0`/`base1` = offsetPx*bpPerPx at fetch). Corners 1/2 belong to the top
// view (view 0), corners 3/4 to the bottom view (view 1).
//
// The base keeps on-screen corners small-magnitude, so a single Float32 per
// corner is sub-pixel accurate — no hi/lo hp-math split. (Absolute cumBp is
// genome-scale, up to Gbp, and would need the split; the base cancels that.)
// This is viable because the fetch is now scoped per window and refetches when
// the window moves, so the base stays near the view. Far-off-screen corners
// (distant-mate diagonals) lose absolute precision but only on the clipped-away
// sliver — visible error stays ~viewportWidth*2^-23.
//
// Curve mode and straight-line mode live in separate shader files
// (syntenyFill{Curve,Straight}.slang, syntenyEdge{Curve,Straight}.slang) so
// there are no `isCurve` branches anywhere; `GpuSyntenyRenderer.render`
// dispatches the appropriate pass per track. This module is mode-agnostic.
module syntenyTypes;

// Re-exported so every synteny pass gets `screenToClip` (and the rest of
// hpmath) from its single `import syntenyTypes;` — the transform is shared
// with the dotplot / hic renderers, so it must not be re-spelled here.
__exported import hpmath;

// Not re-exported: the shared vertex prologue unpacks the instance color, so
// this module owns the dependency and no pass needs to import it.
import colorPack;

public struct Instance {
  public float bp1               : ATTR0;
  public float bp2               : ATTR1;
  public float bp3               : ATTR2;
  public float bp4               : ATTR3;
  public uint  color             : ATTR4;
  public float featureId         : ATTR5;
  public float alignmentLength   : ATTR6;
  // Per-instance KIND tag (KIND_BASE/KIND_CIGAR_*/etc from syntenyColors.ts).
  // The fill fragment uses it only for shading: CIGAR indel tiles get the white
  // pre-blend in shadeFill and skip the density width-fade in fillCoverage. The
  // coverage/AA path is identical to BASE (smooth analytic bezier edge), so
  // indels aren't faceted or aliased.
  public float kind              : ATTR7;
};

// First CIGAR kind. Emitted kinds are KIND_BASE (0), KIND_MARKER (2), and the
// per-CIGAR indel tiles KIND_CIGAR_I/D/N (4/5/6); KIND_CIGAR_MATCH (=3) is only
// this boundary, never an emitted instance. The shaders need just the
// BASE-vs-CIGAR split (kind >= 3), not the exact kind. SYNC: mirrors
// KIND_CIGAR_MATCH (=3) in syntenyColors.ts; CIGAR kinds stay contiguous above.
public static const float KIND_CIGAR_MIN = 3.0;

// Distinguishes indel tiles from whole-feature BASE instances for shading only
// (white pre-blend, no density width-fade); both share the same smoothstep AA.
public bool isCigarKind(float kind) { return kind >= KIND_CIGAR_MIN; }

// KIND_MARKER (=2 in syntenyColors.ts): a periodic "location marker" tick — a
// zero-width vertical line emitted across large matches for visual context.
// Rendered as a fixed 1px line at its own packed alpha, not subject to the
// sub-pixel width fade (which would zero a zero-width quad) or global alpha.
public static const float KIND_MARKER = 2.0;
public bool isMarkerKind(float kind) { return abs(kind - KIND_MARKER) < 0.5; }

// Floor for the density-honest sub-pixel fade below (widthFade). Without a
// floor, a whole-genome view with no minAlignmentLength filter (e.g. a raw
// minimap2 PAF) is almost entirely sub-pixel-thin, so every ribbon fades
// toward zero and overlap accumulation never catches up — the view goes
// nearly blank instead of merely de-emphasized. Keeps a single thin ribbon
// faintly locatable; dense overlaps still read brighter via alpha blend.
public static const float WIDTH_FADE_FLOOR = 0.15;

// Per-view `panPx` + `bpPerPxInv`. `panPx = (base - offsetPx*bpPerPx)/bpPerPx`
// (computed float64 on the main thread from a SMALL delta — see
// GpuSyntenyRenderer.writeUniforms) carries how far the current view has panned
// from the fetch-time base, so `bpRel*bpPerPxInv + panPx` reconstructs the
// LGV-aligned screen X. The delta is bounded by the pan buffer, so panPx is a
// small, exactly-representable Float32.
public struct Uniforms {
  public float2 resolution;
  // Ribbon height in CSS px, floored at 1 by writeUniforms. Floored on the CPU
  // rather than per-shader so `u.height` is directly usable as the y-span and
  // the yCurve scale everywhere, with no `max(u.height, 1.0)` to keep in sync
  // across four shaders (they disagreed on where to apply it).
  public float  height;
  public float  panPx0;
  public float  bpPerPxInv0;
  public float  panPx1;
  public float  bpPerPxInv1;
  public float  overdrawPx;
  public float  minAlignmentLength;
  public float  alpha;
  public float  hoveredFeatureId;
  public float  clickedFeatureId;
  public float  yTop;
  public float  fadeThinAlignments;
  // getDpr() (capped at MAX_DPR), needed because these shaders measure in CSS
  // px but rasterize on the device-px grid — see aaHalfPx.
  public float  devicePixelRatio;
};

// Half-width of every antialiasing ramp in these shaders, in CSS px.
//
// The HAL sizes the backing store by getDpr() and sets the viewport to
// canvas.width/height (DEVICE px), while `resolution` and every coordinate here
// are CSS px. So one output sample spans 1/dpr CSS px, and a ramp that should
// cover exactly one output pixel is 1/dpr CSS px wide — not 1.
//
// This used to arrive implicitly: ddx/ddy differentiate against the device-px
// grid, so `length(ddx(d), ddy(d))` on a CSS-px distance returned 1/dpr and the
// ramp came out one device pixel wide for free. That is the ONE thing the
// derivative was still buying once the distances were perpendicular-normalized
// (see perpCoverage), so dropping it means supplying the ratio explicitly.
public float aaHalfPx(Uniforms u) {
  return 0.5 / u.devicePixelRatio;
}

public struct Corners {
  public float x1, x2, x3, x4;
};

// screenX = (cumBp - offsetPx*bpPerPx)/bpPerPx, with cumBp = bpRel + base folded
// so only small magnitudes reach Float32: bpRel*inv (on-screen bpRel is small)
// plus panPx = (base - offsetPx*bpPerPx)*inv.
public Corners computeCorners(Instance inst, Uniforms u) {
  Corners c;
  c.x1 = inst.bp1 * u.bpPerPxInv0 + u.panPx0;
  c.x2 = inst.bp2 * u.bpPerPxInv0 + u.panPx0;
  c.x3 = inst.bp3 * u.bpPerPxInv1 + u.panPx1;
  c.x4 = inst.bp4 * u.bpPerPxInv1 + u.panPx1;
  return c;
}

public bool isCulled(Corners c, float alignmentLength, Uniforms u) {
  // No `minAlignmentLength > 0` guard needed: lengths are non-negative, so an
  // unset (0) filter never matches.
  if (alignmentLength < u.minAlignmentLength) {
    return true;
  }
  float mOff = u.overdrawPx;
  float rW = u.resolution.x;
  return max(c.x1, c.x2) < -mOff || min(c.x1, c.x2) > rW + mOff
      || max(c.x3, c.x4) < -mOff || min(c.x3, c.x4) > rW + mOff;
}

// Ease-in-out ribbon basis (single source of truth). Curve mode traces y(t) =
// height·yCurve(t) vertically and blends edge X by sBlend(t); the fill-curve
// fragment inverts yCurve via Newton using yCurveDeriv. Keeping the cubic in
// one place stops the four call sites (fill evalT, fill Newton, edge
// hermiteEdges, edge tangent) from drifting out of sync.
public float sBlend(float t)      { return t * t * (3.0 - 2.0 * t); }
public float sBlendDeriv(float t) { return 6.0 * t * (1.0 - t); }
public float yCurve(float t)      { return 1.5 * t * (1.0 - t) + t * t * t; }
public float yCurveDeriv(float t) { return 1.5 - 3.0 * t + 3.0 * t * t; }

// Perpendicular coverage cx for a fill fragment. `edge0`/`edge1` are the two
// ribbon edges at this y (screen X); `pf0`/`pf1` are EACH edge's own slope
// foreshortening (sqrt(1+slope²) of that edge's tangent, not the centerline's).
//
// Using per-edge slopes is the fix for boundary fuzz on curved ribbons: the old
// model measured distance from the centerline with one shared perpFactor, but
// where the two edges diverge in slope — a width-changing / concave-neck region
// — that shared slope is wrong for both edges, so the smoothstep transition
// smeared across many px (visibly fuzzy in transparent mode; hidden behind the
// opaque base in colored mode). Measuring each edge's own signed perpendicular
// distance keeps the transition ~1px on both edges regardless of curvature.
float perpCoverage(float2 localPos, float edge0, float edge1, float pf0,
                   float pf1, float kind, float fadeThinAlignments,
                   float aaHalf) {
  float xL = min(edge0, edge1);
  float xR = max(edge0, edge1);
  float pfL = (edge0 <= edge1) ? pf0 : pf1;
  float pfR = (edge0 <= edge1) ? pf1 : pf0;
  // Signed perpendicular distance (screen px) inward from each edge.
  float dL = (localPos.x - xL) / pfL;
  float dR = (xR - localPos.x) / pfR;
  // Perpendicular (visual) width, averaging the two edge foreshortenings.
  float perpW = (xR - xL) / (0.5 * (pfL + pfR));
  // 1px minimum footprint: push both edges outward for a sub-pixel-thin ribbon
  // so it stays a locatable ~1px band rather than dropping between samples.
  // Wide ribbons (perpW >= 1) are unaffected.
  float expand = max(0.5 - 0.5 * perpW, 0.0);
  dL += expand;
  dR += expand;
  // Density-honest sub-pixel fade, BASE ribbons only: a lone thin alignment
  // fades by its perpendicular width so a whole-genome tangle declutters instead
  // of reading as hard full-opacity lines; dense overlaps still accumulate via
  // alpha blend. CIGAR indel tiles and zero-width markers skip it (widthFade=1);
  // BASE opts out via fadeThinAlignments so a genuinely sparse whole-genome
  // comparison isn't washed out.
  // SYNC: Canvas2DSyntenyRenderer's sub-pixel branch scales its centerline
  // stroke alpha by the equivalent max(perpW, WIDTH_FADE_FLOOR).
  float widthFade =
    (isCigarKind(kind) || isMarkerKind(kind) || fadeThinAlignments < 0.5)
      ? 1.0
      : clamp(perpW, WIDTH_FADE_FLOOR, 1.0);
  // Per-edge AA, one output pixel each (aaHalf; see aaHalfPx). dL/dR are
  // constructed as TRUE perpendicular distances — each divided by its own edge's
  // foreshortening — so the ramp width is a known constant at every slope rather
  // than something to measure. NOT fwidth (=|ddx|+|ddy|), which overshoots by up
  // to √2 on diagonals and softens slanted ribbon edges. See
  // drewcassidy.me/2020/06/26/sdf-antialiasing/.
  //
  // Measuring it with ddx/ddy (what this did before) is wrong in the two places
  // the derivative stops matching the analytic value. In the AA rows above and
  // below the ribbon the caller's `t` clamps, freezing the edges, and the
  // measured gradient collapses by a further 1/pf (0.05-0.32 of its correct
  // value on slanted ribbons) — a near-hard side edge on the ribbon's top and
  // bottom rows. At a bowtie's pinch the 2x2 quad straddles the edge-identity
  // swap and reads 0.707. aaHalf is right in both.
  return smoothstep(-aaHalf, aaHalf, dL)
       * smoothstep(-aaHalf, aaHalf, dR) * widthFade;
}

// Ribbon edge X positions + per-edge slope foreshortening at a point along the
// ribbon, shared by both fill passes so the drift-prone per-edge slope formula
// (the boundary-fuzz fix documented in perpCoverage) lives in ONE place. `s` is
// the X-blend value and `sd = ds/dt`, `dydt = dy/dt` give each edge its own
// dx/dy: straight mode passes s=t, sd=1, dydt=h (linear y); curve mode passes
// s=sBlend(t), sd=sBlendDeriv(t), dydt=h·yCurveDeriv(t).
struct FillEdges {
  float edge0;
  float edge1;
  float pf0;
  float pf1;
};

FillEdges fillEdges(float4 corners, float s, float sd, float dydt) {
  FillEdges e;
  e.edge0 = lerp(corners.x, corners.w, s);
  e.edge1 = lerp(corners.y, corners.z, s);
  float dxdy = sd / max(abs(dydt), 1e-4);
  float slope0 = (corners.w - corners.x) * dxdy;
  float slope1 = (corners.z - corners.y) * dxdy;
  e.pf0 = sqrt(1.0 + slope0 * slope0);
  e.pf1 = sqrt(1.0 + slope1 * slope1);
  return e;
}

// Analytic coverage for a fill fragment. `localPos.x` is screen X, `localPos.y`
// is the vertical offset from yTop. `edge0`/`edge1` are the ribbon edges at this
// y and `pf0`/`pf1` each edge's slope foreshortening. BASE ribbons and CIGAR
// indel tiles share this analytic per-edge AA so both trace the smooth analytic
// bezier edges with antialiased (not stair-stepped) sides; only the density
// width-fade differs.
float fillCoverage(float2 localPos, float edge0, float edge1,
                   float pf0, float pf1, float kind, float h,
                   float fadeThinAlignments, float aaHalf) {
  float cx = perpCoverage(localPos, edge0, edge1, pf0, pf1, kind,
                          fadeThinAlignments, aaHalf);
  // One-output-pixel AA at the top/bottom cuts. Both vertex shaders set
  // localPos.y = screenY - u.yTop exactly, so localPos.y is affine in screen y
  // with unit slope — the ramp is aaHalf wide by construction, no derivative to
  // take.
  float cy = smoothstep(-aaHalf, aaHalf, localPos.y)
           - smoothstep(h - aaHalf, h + aaHalf, localPos.y);
  return cx * cy;
}

// Fill fragment output: feature color with hover darkening + alpha boost, with
// coverage folded into the alpha (straight, not premultiplied — the HAL's
// default blend is src-alpha / one-minus-src-alpha).
// SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
// Canvas2DSyntenyRenderer.ts's hover branch.
// CIGAR kinds are indel quads drawn over a visible base block. Non-hovered
// indels are pre-blended with white at u.alpha and output fully opaque, so
// they visually fade like they're over a white background while still fully
// covering the base block (avoids double-fade against the base block color).
float4 shadeFill(float4 color, float featureId, float coverage, float kind,
                 Uniforms u) {
  float3 rgb = color.rgb;
  // Markers carry their own fixed alpha (0.25) and ignore colorBy, global
  // display alpha, and hover — matching the legacy fixed context lines.
  if (isMarkerKind(kind)) {
    return float4(rgb, color.a * coverage);
  }
  bool isHovered = u.hoveredFeatureId > 0.0
    && abs(featureId - u.hoveredFeatureId) < 0.5;
  if (isCigarKind(kind)) {
    // Pre-blend with white so the indel fades against white regardless of what
    // the base block drew. blendAlpha mirrors the original alpha formula so
    // hover (min(u.alpha*5, 0.35)) and normal (u.alpha) match origin/main.
    // Apply 0.7 darkening inside the blend — same order as the original formula
    // (darken first, then blend with white) so the hover color is identical.
    float blendAlpha = isHovered
      ? min(color.a * u.alpha * 5.0, 0.35)
      : color.a * u.alpha;
    float darken = isHovered ? 0.7 : 1.0;
    rgb = rgb * darken * blendAlpha + float3(1.0, 1.0, 1.0) * (1.0 - blendAlpha);
    return float4(rgb, color.a * coverage);
  }
  float baseAlpha = color.a * u.alpha;
  rgb *= isHovered ? 0.7 : 1.0;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  return float4(rgb, finalAlpha * coverage);
}

// Clicked-feature outline: a 1 CSS px line, i.e. half-max STROKE_HALF_PX either
// side of the edge. STROKE_PERP_PX is how far the ramp can reach in the worst
// case (STROKE_HALF_PX + aaHalf, maximal at dpr=1), and so how much extra room
// the geometry has to leave — see the geometry functions' extraPerpPx.
static const float STROKE_HALF_PX = 0.5;
public static const float STROKE_PERP_PX = 1.0;
static const float STROKE_ALPHA = 0.4;

// Extra horizontal vertex pad (px) covering perpCoverage's `expand` term, which
// pushes both edges outward by up to 0.5 PERPENDICULAR px — i.e. up to
// perpFactor·0.5 horizontal px — to hold a sub-pixel-thin ribbon at a locatable
// 1px. Both fill passes used to pad only for the AA ramp, so on a steep thin
// ribbon the geometry cropped that very band: measured 8.4px of lost coverage in
// straight mode and 90px in curve mode on a 3000px-run / 20px-tall ribbon. The
// visible result was that the 1px floor silently didn't hold at steep slopes —
// exactly the whole-genome case it exists for — and the sides came out
// hard-cut instead of antialiased.
//
// Bounded by the ribbon's MINIMUM horizontal width, so a ribbon wider than
// perpFactor px gets no extra pad at all and the per-segment saving in
// syntenyFillCurve is untouched. Both modes have edge1 - edge0 =
// lerp(x2-x1, x3-x4, s) exactly, monotonic in s, so the width can only reach
// zero mid-ribbon when the two endpoint deltas differ in sign (a bowtie).
// SYNC: mirrored by `padExtra` in syntenyFillCurvePad.test.ts.
public float thinRibbonPad(float perpFactor, Corners c) {
  float dTop = c.x2 - c.x1;
  float dBot = c.x3 - c.x4;
  float wMin = dTop * dBot < 0.0 ? 0.0 : min(abs(dTop), abs(dBot));
  return max(perpFactor * 0.5 - 0.5 * wMin, 0.0);
}

// The two ribbon edges at X-blend `s`, ordered left/right — they swap on a
// crossed "bowtie" ribbon, which is why every caller takes min/max rather than
// assuming an order. Straight mode passes s=t, curve mode s=sBlend(t).
public float2 edgeSpan(Corners c, float s) {
  float e0 = lerp(c.x1, c.x4, s);
  float e1 = lerp(c.x2, c.x3, s);
  return float2(min(e0, e1), max(e0, e1));
}

// Everything the two fill passes share. They differ only in geometry — one quad
// vs 8 tessellated bezier segments — so the varyings, the vertex prologue, and
// the whole fragment live here and each pass is left holding just its own
// polygon. Mirrors the rowRect module's split (render-core).
public struct FillVsOut {
  public float4 position : SV_Position;
  public float4 color    : COLOR0;
  public nointerpolation float featureId : COLOR1;
  // Per-instance corner positions in CSS-pixel screen X. (x, y) belong to the
  // top view, (z, w) to the bottom — i.e. Corners x1..x4 in order.
  public nointerpolation float4 corners : COLOR2;
  // Local position within the instance: localPos.x = screen X (CSS px),
  // localPos.y = vertical offset from yTop in CSS px (≈[0, height], extended
  // ~1px at the ends for the AA fade).
  public float2 localPos : COLOR3;
  // The raw KIND tag, so the fragment calls isCigarKind/isMarkerKind instead of
  // each pass re-spelling them as separate float flags.
  public nointerpolation float kind : COLOR4;
};

// Vertex prologue: fills everything independent of the pass's geometry and
// returns false when the instance is culled, with `o` already zeroed to a
// degenerate vertex. `c` is the projected corner set the caller builds its
// polygon from.
public bool fillVsBegin(Instance inst, Uniforms u, out FillVsOut o,
                        out Corners c) {
  o.position = float4(0.0);
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;
  o.corners = float4(0.0);
  o.localPos = float2(0.0);
  o.kind = inst.kind;
  c = computeCorners(inst, u);
  if (isCulled(c, inst.alignmentLength, u)) {
    return false;
  }
  o.corners = float4(c.x1, c.x2, c.x3, c.x4);
  return true;
}

// Vertex epilogue: place the vertex at screen (vx, yTop + y) and record the
// local position the fragment measures coverage from. Setting both here is what
// makes localPos.y affine in screen y with unit slope — the property
// fillCoverage's constant vertical AA relies on.
public void fillVsEmit(inout FillVsOut o, float vx, float y, Uniforms u) {
  o.localPos = float2(vx, y);
  o.position = screenToClip(float2(vx, u.yTop + y), u.resolution);
}

// The entire fill fragment. `s` is the pass's X-blend at this fragment, `sd`
// its ds/dt and `dydt` its dy/dt (straight: t, 1, height; curve: sBlend(t),
// sBlendDeriv(t), height·yCurveDeriv(t)). fillEdges turns those into each
// edge's own X and foreshortening.
public float4 fillFs(FillVsOut i, float s, float sd, float dydt, Uniforms u) {
  FillEdges e = fillEdges(i.corners, s, sd, dydt);
  float coverage = fillCoverage(i.localPos, e.edge0, e.edge1, e.pf0, e.pf1,
                                i.kind, u.height, u.fadeThinAlignments,
                                aaHalfPx(u));
  if (coverage <= 0.0) {
    discard;
  }
  return shadeFill(i.color, i.featureId, coverage, i.kind, u);
}

// Clicked-feature outline: a 1px antialiased black stroke on BOTH ribbon edges,
// measured against the SAME analytic edges fillFs clips to, from the SAME
// geometry. The outline therefore cannot drift from the shape it outlines.
//
// It used to stroke a chord approximation instead: each edge tessellated into
// 16 straight pieces, expanded along the chord normal. Straight ribbons were
// exact, but on a curve the chords sit off the analytic bezier by up to 11.7px
// (worst over a 3000-case sweep of run/height; 3.7px on a 1400px-run, 400px-tall
// track), so the hairline visibly cut the corner across the ribbon it marked.
// Reparametrising the tessellation to cluster segments where |s''| peaks only
// got that to 3.65px — the chords were the wrong primitive, not badly placed.
//
// Both edges in one pass over the ribbon geometry: no per-edge tessellation, no
// chord normals, and 48 verts/instance in curve mode instead of 192.
public float4 strokeFs(FillVsOut i, float s, float sd, float dydt, Uniforms u) {
  FillEdges e = fillEdges(i.corners, s, sd, dydt);
  // True perpendicular distance to each edge (see perpCoverage — dividing by
  // the edge's own foreshortening is what makes 1.0 mean one on-screen pixel at
  // every slope).
  float d0 = abs(i.localPos.x - e.edge0) / e.pf0;
  float d1 = abs(i.localPos.x - e.edge1) / e.pf1;
  // A stroke of fixed CSS width (half-max at STROKE_HALF_PX, so 1 CSS px wide
  // at any dpr) with a one-output-pixel ramp. The ramp reaches zero at
  // STROKE_HALF_PX + aaHalf ≤ STROKE_PERP_PX, which is what the geometry's
  // extraPerpPx guarantees room for.
  float aaHalf = aaHalfPx(u);
  float band = max(clamp((STROKE_HALF_PX - d0) / (2.0 * aaHalf) + 0.5, 0.0, 1.0),
                   clamp((STROKE_HALF_PX - d1) / (2.0 * aaHalf) + 0.5, 0.0, 1.0));
  // Cap the stroke at the ribbon's top and bottom, matching fillCoverage's
  // vertical AA so the outline ends exactly where the fill does.
  float cy = smoothstep(-aaHalf, aaHalf, i.localPos.y)
           - smoothstep(u.height - aaHalf, u.height + aaHalf, i.localPos.y);
  float alpha = band * cy * STROKE_ALPHA;
  if (alpha <= 0.0) {
    discard;
  }
  return float4(0.0, 0.0, 0.0, alpha);
}

// Only the clicked feature's BASE silhouette is outlined — never per-CIGAR-tile
// instances (kind >= 3.0, would outline every M/I/D/N tile) nor KIND_MARKER
// context ticks (interior lines, not part of the silhouette).
public bool isClickedSilhouette(Instance inst, Uniforms u) {
  return u.clickedFeatureId > 0.0
    && abs(inst.featureId - u.clickedFeatureId) < 0.5
    && !isCigarKind(inst.kind)
    && !isMarkerKind(inst.kind);
}

// ---------------------------------------------------------------------------
// Ribbon geometry. Two functions, one per mode — no `isCurve` branch. Each is
// shared by that mode's fill pass and its clicked-outline pass, which draw the
// SAME polygon and differ only in the fragment; that is what guarantees the
// outline traces the fill.
//
// `extraPerpPx` widens the polygon by that many PERPENDICULAR px on each side.
// The fill passes 0 (the pad already covers coverage's own footprint); the
// outline passes STROKE_PERP_PX, because its stroke reaches a full perpendicular
// pixel OUTSIDE each edge while the fill pad only guarantees ~0.5 there.
// ---------------------------------------------------------------------------

public static const uint CURVE_SEGMENTS = 8u;

// One quad (6 verts). Vert layout: 0=TL, 1=TR, 2=BL, 3=BL, 4=TR, 5=BR;
// triangles (TL, TR, BL) and (BL, TR, BR).
public void straightGeometry(inout FillVsOut o, Corners c, uint vid,
                             float extraPerpPx, Uniforms u) {
  bool isTop = (vid == 0u || vid == 1u || vid == 4u);
  bool isRight = (vid == 1u || vid == 4u || vid == 5u);

  // The ribbon's left/right x at this end of the trapezoid (s=0 top, s=1
  // bottom), ordered so a crossed ribbon still gets a forward-facing quad.
  float2 span = edgeSpan(c, isTop ? 0.0 : 1.0);

  // Perpendicular pad (in horizontal pixels). Accommodates:
  //   (1) the AA ramp's perpendicular half-pixel: perpFactor·0.5.
  //   (2) perpCoverage's sub-pixel `expand`, via thinRibbonPad — zero for any
  //       ribbon wider than perpFactor px.
  //   (3) the caller's extraPerpPx, projected onto x at this slope.
  //   (4) AA fade at the boundary: 1 px.
  //
  // Term (1) scales with the slope of the STEEPER edge, not the centerline
  // average. The average under-pads whichever edge travels further on a
  // width-changing ribbon (measured: 0.94px of the AA ramp cropped on corners
  // (100, 900, 1200, 1180) at h=100, 4.5px on a crossed steep one), which is
  // the same reasoning that put maxEdgeDx in the curve pad below.
  //
  // CIGAR indel tiles use the same padded polygon as BASE — they share the
  // analytic edge + smoothstep AA path (fillCoverage), so their perpendicular
  // edges antialiase against the base block instead of stair-stepping.
  float slope = max(abs(c.x4 - c.x1), abs(c.x3 - c.x2)) / u.height;
  float perpFactor = sqrt(1.0 + slope * slope);
  float pad = perpFactor * (0.5 + extraPerpPx) + thinRibbonPad(perpFactor, c)
            + 1.0;

  fillVsEmit(o,
             isRight ? span.y + pad : span.x - pad,
             isTop ? -1.0 : u.height + 1.0,
             u);
}

// CURVE_SEGMENTS trapezoids (6 verts each) hugging the local bezier strip. The
// fragment clips to the true bezier analytically, so the visible edge is the
// smooth curve regardless of the segment count — 8 is plenty. (An earlier
// attempt drew indel tiles from the raw chord geometry to get MSAA seam-tiling,
// but the chords visibly faceted slanted ribbons, so indels went back on the
// analytic curve.) Halving to 4 makes the bulge term dominate the pad; doubling
// to 16 gives diminishing returns.
public void curveGeometry(inout FillVsOut o, Corners c, uint vid,
                          float extraPerpPx, Uniforms u) {
  uint seg = vid / 6u;
  uint vertInSeg = vid % 6u;
  bool isTop = (vertInSeg == 0u || vertInSeg == 1u || vertInSeg == 4u);
  bool isRight = (vertInSeg == 1u || vertInSeg == 4u || vertInSeg == 5u);

  float invN = 1.0 / float(CURVE_SEGMENTS);
  float t0 = float(seg) * invN;
  float t1 = float(seg + 1u) * invN;
  float t = isTop ? t0 : t1;

  float2 span = edgeSpan(c, sBlend(t));
  float y = u.height * yCurve(t);

  // Perpendicular pad (in horizontal pixels). Accommodates:
  //   (1) the AA ramp's perpendicular half-pixel: perpFactor·0.5, at THIS
  //       segment's steepest slope.
  //   (2) perpCoverage's sub-pixel `expand`, via thinRibbonPad — zero for any
  //       ribbon wider than perpFactor px, so it costs the common case nothing.
  //   (3) the caller's extraPerpPx, projected onto x at this segment's slope.
  //   (4) bezier bulge within the segment: max|s''|·dt²/8 in s-units, scaled
  //       by max edge Δ.
  //   (5) AA fade at the boundary: 1 px.
  //
  // Term (1) is per-segment. It used to use the ribbon-wide maximum, which
  // over-pads every segment but the middle one: local dx/dy peaks at 2× the
  // chord slope only near t=0.5, and falls to 0 at the ends where the x-curve
  // is momentarily vertical. Bounding it per segment is exact (the ratio below
  // is unimodal, so its max over the segment is a single evaluation) and cuts
  // the rasterized-then-discarded area of a thin steep ribbon by a measured
  // 10-17% (`syntenyFillPad.test.ts` computes both).
  //
  // Term (4) is deliberately still the ribbon-wide bound. Do NOT try to make it
  // per-segment via |s''(t)| = |6-12t| (which is 0 at t=0.5, so it looks like
  // free savings): that bounds the curve's deviation from its chord in *t*, but
  // this quad interpolates x linearly in *screen y*, and y(t) is itself
  // nonlinear, so the y-reparameterization adds deviation the t-chord bound
  // misses. It under-pads for real — corners (0, 300, 1400, 1500) at h=400
  // clip the analytic edge by 0.27px. The test pins that counterexample.
  //
  // CIGAR indel tiles use the same pad as BASE — they clip to the smooth
  // analytic curve in the fragment, not to this trapezoid geometry.
  //
  // The pad protects the EDGES, so it scales with the larger edge Δ, not the
  // centerline's (they differ on a width-changing ribbon, where the centerline
  // average under-pads the wider edge).
  float maxEdgeDx = max(abs(c.x4 - c.x1), abs(c.x3 - c.x2));
  // dx/dy = (Δ/h)·sBlendDeriv(t)/yCurveDeriv(t). That ratio is unimodal with
  // its peak of 2.0 at t=0.5, so its maximum over the segment is at whichever
  // in-range t sits closest to 0.5.
  float tPeak = clamp(0.5, t0, t1);
  float segSlope = maxEdgeDx / u.height * sBlendDeriv(tPeak)
                 / yCurveDeriv(tPeak);
  float perpFactor = sqrt(1.0 + segSlope * segSlope);
  float bulgeX = maxEdgeDx * invN * invN * 0.75;
  float pad = perpFactor * (0.5 + extraPerpPx) + thinRibbonPad(perpFactor, c)
            + bulgeX + 1.0;

  // AA y-pad only at the first segment's top and last segment's bottom; the
  // shared boundaries between adjacent segments must match exactly.
  if (seg == 0u && isTop) { y -= 1.0; }
  if (seg == CURVE_SEGMENTS - 1u && !isTop) { y += 1.0; }

  fillVsEmit(o, isRight ? span.y + pad : span.x - pad, y, u);
}

// Recover the bezier parameter t from a fragment's vertical position. 2 Newton
// iterations on the strictly-monotonic y(t) = h·(t³ − 1.5t² + 1.5t) converge to
// sub-pixel accuracy from t₀ = yFrac (f' ≥ 0.75 on [0,1]). Measured: 1 iteration
// leaves 5.8px of x error on a 3000px-run ribbon, 2 leaves 0.01px, 3 gains
// nothing. Do NOT replace this with a t varying interpolated between the
// segment's t0/t1 — t is nonlinear in screen y, and at 8 segments that is 17px
// out. (`s = 3t − 2·yFrac` is an exact identity here, but feeding it the
// approximate t triples the residual, where sBlend(t) only multiplies it by
// sBlendDeriv ≤ 1.5.)
public float curveParamAtY(float yLocal, Uniforms u) {
  float yFrac = clamp(yLocal / u.height, 0.0, 1.0);
  float t = yFrac;
  for (int i = 0; i < 2; i++) {
    t = t - (yCurve(t) - yFrac) / yCurveDeriv(t);
  }
  return clamp(t, 0.0, 1.0);
}
