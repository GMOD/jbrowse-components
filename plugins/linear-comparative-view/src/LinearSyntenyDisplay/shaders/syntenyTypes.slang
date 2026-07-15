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

// First CIGAR kind. Kinds 0..2 are whole-feature (KIND_BASE/BASE_HIDDEN/MARKER);
// kinds >= 3 are per-CIGAR tiles (KIND_CIGAR_MATCH/I/D/N/HIDDEN). The shaders
// only need the BASE-vs-CIGAR split, not the exact kind.
// SYNC: mirrors KIND_CIGAR_MATCH (=3) in LinearSyntenyRPC/syntenyColors.ts; the
// whole CIGAR range must stay contiguous and above the non-CIGAR kinds.
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
};

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
  if (u.minAlignmentLength > 0.0 && alignmentLength < u.minAlignmentLength) {
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

// Screen-space (CSS px, top-left origin) → clip space, with the Y flip every
// synteny pass needs.
public float4 screenToClip(float2 screen, float2 resolution) {
  float2 clip = screen / resolution * 2.0 - 1.0;
  return float4(clip.x, -clip.y, 0.0, 1.0);
}

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
float perpCoverage(float2 localPos, float edge0, float edge1,
                   float pf0, float pf1, float isCigar, float isMarker,
                   float fadeThinAlignments) {
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
    (isCigar > 0.5 || isMarker > 0.5 || fadeThinAlignments < 0.5)
      ? 1.0
      : clamp(perpW, WIDTH_FADE_FLOOR, 1.0);
  // Per-edge AA, 1px each. dL/dR are already true perpendicular distances, so
  // the AA width is the length of their screen-space gradient (= 1 at every
  // slope) — NOT fwidth (=|ddx|+|ddy|), which overshoots by up to √2 on
  // diagonals and softens slanted ribbon edges. Clamped to bound any residual
  // derivative spike. See drewcassidy.me/2020/06/26/sdf-antialiasing/.
  float aaL = clamp(length(float2(ddx(dL), ddy(dL))), 1e-4, 1.5);
  float aaR = clamp(length(float2(ddx(dR), ddy(dR))), 1e-4, 1.5);
  return smoothstep(-aaL * 0.5, aaL * 0.5, dL)
       * smoothstep(-aaR * 0.5, aaR * 0.5, dR) * widthFade;
}

// Ribbon edge X positions + per-edge slope foreshortening at a point along the
// ribbon, shared by both fill passes so the drift-prone per-edge slope formula
// (the boundary-fuzz fix documented in perpCoverage) lives in ONE place. `s` is
// the X-blend value and `sd = ds/dt`, `dydt = dy/dt` give each edge its own
// dx/dy: straight mode passes s=t, sd=1, dydt=h (linear y); curve mode passes
// s=sBlend(t), sd=sBlendDeriv(t), dydt=h·yCurveDeriv(t).
public struct FillEdges {
  public float edge0;
  public float edge1;
  public float pf0;
  public float pf1;
};

public FillEdges fillEdges(float4 corners, float s, float sd, float dydt) {
  FillEdges e;
  e.edge0 = lerp(corners.x, corners.w, s);
  e.edge1 = lerp(corners.y, corners.z, s);
  float slope0 = (corners.w - corners.x) * sd / max(abs(dydt), 1e-4);
  float slope1 = (corners.z - corners.y) * sd / max(abs(dydt), 1e-4);
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
public float fillCoverage(float2 localPos, float edge0, float edge1,
                          float pf0, float pf1, float isCigar, float isMarker,
                          float h, float fadeThinAlignments) {
  float cx = perpCoverage(localPos, edge0, edge1, pf0, pf1, isCigar, isMarker,
                          fadeThinAlignments);
  float ay = max(length(float2(ddx(localPos.y), ddy(localPos.y))), 1e-4) * 0.5;
  float cy = smoothstep(-ay, ay, localPos.y)
           - smoothstep(h - ay, h + ay, localPos.y);
  return cx * cy;
}

// Fill fragment output: feature color with hover darkening + alpha boost,
// premultiplied by coverage.
// SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
// Canvas2DSyntenyRenderer.ts's hover branch.
// isCigar: 1.0 for indel quads drawn over a visible base block. Non-hovered
// indels are pre-blended with white at u.alpha and output fully opaque, so
// they visually fade like they're over a white background while still fully
// covering the base block (avoids double-fade against the base block color).
public float4 shadeFill(float4 color, float featureId, float coverage,
                        float isCigar, float isMarker, Uniforms u) {
  float3 rgb = color.rgb;
  // Markers carry their own fixed alpha (0.25) and ignore colorBy, global
  // display alpha, and hover — matching the legacy fixed context lines.
  if (isMarker > 0.5) {
    return float4(rgb, color.a * coverage);
  }
  bool isHovered = u.hoveredFeatureId > 0.0
    && abs(featureId - u.hoveredFeatureId) < 0.5;
  if (isCigar > 0.5) {
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

// Edge-pass fragment output: 1px antialiased black stroke at 0.4 alpha. `dist`
// is the signed perpendicular distance from the edge centerline in px; the
// geometry expands ±STROKE_WIDTH (±1px) around a 0.5px half-width, so the
// analytic ramp reaches zero exactly at the quad boundary.
//
// Analytic SDF coverage (mirrors wiggle center-line, commit 06ea37ff44): divide
// the edge distance by the true gradient magnitude (length of the screen-space
// derivative, = 1 at every angle) rather than fwidth, and bias by +0.5 so the
// core stays fully opaque. The old fwidth + symmetric-smoothstep form put
// half-coverage ~0.75px out (a blurry ~1.5px stroke) and widened on diagonals.
public float4 edgeStrokeColor(float dist) {
  float aa = max(length(float2(ddx(dist), ddy(dist))), 1e-4);
  float edgeAlpha = clamp((0.5 - abs(dist)) / aa + 0.5, 0.0, 1.0);
  return float4(0.0, 0.0, 0.0, edgeAlpha * 0.4);
}

// Unit normal to an edge tangent (perpendicular in screen space), shared by
// both edge passes. The stroke is symmetric (±side expansion, abs(dist) in the
// fragment), so the sign is irrelevant — only the perpendicular direction
// matters. Degenerate (zero-length) tangents fall back to vertical.
public float2 edgeNormal(float2 tangent) {
  float len = length(tangent);
  return len > 0.001 ? float2(-tangent.y, tangent.x) / len : float2(0.0, 1.0);
}
