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
// The two kind predicates are pure scalar decisions the Canvas2D renderer and
// the CPU pick engine must make identically; both import the generated twins
// rather than re-spelling the thresholds (adr-051).
//! js-export: isCigarKind, isMarkerKind, spanOutsideBand, markerTravelsTooFar, fillShade, hoverDarken, thinWidthFade, sBlend, yCurve
//! export-consts: KIND_CIGAR_MIN, KIND_MARKER
//! js-skip: sBlendDeriv — the ribbon tangent, for extruding an edge normal per fragment; Canvas2D draws one bezierCurveTo and never needs the derivative
//! js-skip: yCurveDeriv — same as sBlendDeriv, the other half of the tangent
//! js-skip: vertCoverage — the top/bottom antialiasing ramp, measured per fragment; Canvas2D gets its edge AA from the rasterizer
//! js-skip: perpCoverage — measures perpendicular width per fragment from each edge own foreshortening, where Canvas2D measures it once for the whole ribbon (ribbonPerpWidth). Same quantity, deliberately different estimator — only the perpW < 1 boundary is shared, and that is a comparison, not a function
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
  // pre-blend in shadeFill and skip the density width-fade in fillFs. The
  // coverage/AA path is identical to BASE (smooth analytic bezier edge), so
  // indels aren't faceted or aliased.
  public float kind              : ATTR7;
};

// First CIGAR kind, and the source of truth for the boundary: syntenyColors.ts
// derives `KIND_CIGAR_MATCH` from this via `//! export-consts`, and numbers the
// CIGAR kinds contiguously above it. Emitted kinds are KIND_BASE (0),
// KIND_MARKER (2), and the per-CIGAR indel tiles I/D/N (4/5/6) — the boundary
// itself is never an emitted instance. The shaders need only the
// BASE-vs-CIGAR split, not the exact kind.
public static const float KIND_CIGAR_MIN = 3.0;

// Distinguishes indel tiles from whole-feature BASE instances for shading only
// (white pre-blend, no density width-fade); both share the same smoothstep AA.
public bool isCigarKind(float kind) { return kind >= KIND_CIGAR_MIN; }

// The "location marker" tick: a periodic zero-width vertical line emitted
// across large matches for visual context.
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

// The fade curve itself, as both backends apply it: identity unless the ribbon
// is a fadeable BASE one, then its perpendicular width floored and capped.
// `applies` is passed in rather than derived from `kind` because the two
// callers reach the same answer by different routes — the fragment shader tests
// the kind it was handed, while Canvas2D has already `continue`d past markers
// and knows `isCigar` — and because the decision is a product one either way.
public float thinWidthFade(float perpW, bool applies) {
  return applies ? clamp(perpW, WIDTH_FADE_FLOOR, 1.0) : 1.0;
}

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

// The four projected corner X positions in CSS-px screen space, held as a plain
// float4 with lanes (x1, x2, x3, x4) — x/y are the top view's corners, z/w the
// bottom view's. This is the SAME value FillVsOut.corners carries, so the vertex
// stage hands the fragment its corners without repacking a struct into a vector.
//
// The lanes are corners, not edges. Which corner pairs with which to form the two
// ribbon EDGES is stated in exactly one place, `ribbonEdges`, and everything that
// needs an edge — the vertex polygon, the fragment's analytic clip, the pads —
// goes through it or through the two derived helpers beside it.
//
// screenX = (cumBp - offsetPx*bpPerPx)/bpPerPx, with cumBp = bpRel + base folded
// so only small magnitudes reach Float32: bpRel*inv (on-screen bpRel is small)
// plus panPx = (base - offsetPx*bpPerPx)*inv.
public float4 computeCorners(Instance inst, Uniforms u) {
  return float4(inst.bp1 * u.bpPerPxInv0 + u.panPx0,
                inst.bp2 * u.bpPerPxInv0 + u.panPx0,
                inst.bp3 * u.bpPerPxInv1 + u.panPx1,
                inst.bp4 * u.bpPerPxInv1 + u.panPx1);
}

// Does [lo, hi] lie entirely outside the visible band, which is [0, w] widened
// by `pad` on both sides?
//
// Six sites ask it: the hull and the two ribbon edges in `isCulled` below, and
// the same three in `isRibbonCulled` (syntenyRibbonPath.ts), which the Canvas2D
// draw and the CPU pick engine share. `isCulled` takes a float4 and so is
// outside the twin emitter's scalar subset — the CPU side cannot import the
// whole decision, so this is the part of it that is `//! js-export`ed, and the
// comparison is one function for all six.
//
// `pad` is a parameter rather than `u.overdrawPx` read inside because the two
// sides pass different pads: the band's overdraw for the per-edge tests, and on
// the CPU a tighter canvas-edge one for the hull. Which pad applies is the
// caller's decision; the comparison is not.
public bool spanOutsideBand(float lo, float hi, float w, float pad) {
  return hi < -pad || lo > w + pad;
}

// The second marker rule, beside the hull one in `isCulled`: how far a tick may
// travel horizontally between its two ends before it stops being a mark.
//
// A tick is a line from a point in the top view to the point it maps to in the
// bottom one, and the hull test keeps it whenever that LINE touches the frame —
// right geometry, and past a certain shear a useless mark: the line enters the
// band at one edge and leaves at the other, drawing a few degrees off horizontal
// with neither end anywhere a reader can look.
// `hg002_haplotypes_location_markers` shipped with one across the top of its
// ribbon and was denied for it twice ("please double check previous agents notes
// about the almost horizontal line. i dont like it"); rendering the same window
// with markers off is what identified it, since it looks like a border rather
// than a mark.
//
// THIS OVERRIDES THE HULL RULE'S DISTINCTIVE CASE, and saying so is the point of
// the comment. A tick with its two ends outside the band in OPPOSITE directions —
// the case the hull test is written for, where testing the ends separately would
// drop a tick that crosses the frame at mid-height — spans the band, so it
// travels further than the view is wide by construction and this cap always
// takes it. The two rules cannot both hold there: the shape the hull rule
// protects and the shape the review rejected are the same shape. What the hull
// rule keeps that this still allows is the ordinary case — one end off-screen,
// the other on it.
//
// What survives is what a marker is for. An inversion or an indel INSIDE the
// frame shears a tick by at most about what is on screen, so the cap sits above
// every correspondence a reader could follow with their eyes and below every one
// they could not.
//
// THE VIEW'S WIDTH, and asked HERE rather than where the worker emits the tick.
// The travel is a function of how far the two views have panned APART, and they
// drift by up to a pan buffer without refetching (`fetchRegionsKey` snaps to a
// buffer-sized grid), which is wider than the cap. Answered at fetch time the
// rule therefore went stale on exactly the pan that makes it wrong: pan one row
// alone and every tick on screen now travels further than the cap allows while
// all of them keep drawing, which is the near-horizontal line back again — and
// ticks dropped at fetch time stayed dropped once a pan brought their ends
// together. Both backends ask it per frame instead, against the live pan.
public bool markerTravelsTooFar(float topX, float bottomX, float w) {
  return abs(topX - bottomX) > w;
}

public bool isCulled(float4 c, float alignmentLength, float kind, Uniforms u) {
  // No `minAlignmentLength > 0` guard needed: lengths are non-negative, so an
  // unset (0) filter never matches.
  if (alignmentLength < u.minAlignmentLength) {
    return true;
  }
  float mOff = u.overdrawPx;
  float rW = u.resolution.x;
  // Hull: nothing of the instance is anywhere near the band. Subsumed by the
  // per-edge test below for a ribbon (both edges out implies the hull is out),
  // so it is here for the marker case, which returns right after it.
  if (spanOutsideBand(min(min(c.x, c.y), min(c.z, c.w)),
                      max(max(c.x, c.y), max(c.z, c.w)), rW, mOff)) {
    return true;
  }
  // A MARKER STOPS HERE. It is a 1px line between two points, one per view, so
  // the hull is its whole extent and either endpoint being on screen means part
  // of the line is. The per-edge test below would drop it whenever ONE endpoint
  // left the band — and the two endpoints of a marker are exactly what a
  // crossed ribbon pulls apart, so on an inversion spanning the frame, panning
  // past the overdraw band deleted the leading half of the tick fan while the
  // ribbon under it stayed.
  //
  // What replaces the per-edge test for a marker is the travel cap, which is the
  // rule that shape actually needs — see markerTravelsTooFar. A marker's two
  // corners per view coincide, so c.x and c.z are its two ends.
  if (isMarkerKind(kind)) {
    return markerTravelsTooFar(c.x, c.z, rW);
  }
  // Per-edge for ribbons, and deliberately harsher than the hull: an edge
  // entirely outside the band contributes only a sliver, and keeping the
  // instance costs a trapezoid spanning the whole horizontal travel.
  return spanOutsideBand(min(c.x, c.y), max(c.x, c.y), rW, mOff)
      || spanOutsideBand(min(c.z, c.w), max(c.z, c.w), rW, mOff);
}

// Ease-in-out ribbon basis (single source of truth). Curve mode traces y(t) =
// height·yCurve(t) vertically and blends edge X by sBlend(t); the fill-curve
// fragment inverts yCurve via Newton using yCurveDeriv. Keeping the cubic in
// one place stops the four call sites (fill evalT, fill Newton, edge
// hermiteEdges, edge tangent) from drifting out of sync.
//
// There is a fifth call site, and it is not in a shader: the Canvas2D/SVG path
// draws this curve as a `bezierCurveTo` with both control points at midheight
// (syntenyRibbonPath.ts), which is the same cubic in a different
// parameterization. `//! js-export`ed so the identity is checked at those
// control points rather than asserted in a comment — the two derivatives stay
// shader-only, since Canvas2D never inverts the curve.
public float sBlend(float t)      { return t * t * (3.0 - 2.0 * t); }
public float sBlendDeriv(float t) { return 6.0 * t * (1.0 - t); }
public float yCurve(float t)      { return 1.5 * t * (1.0 - t) + t * t * t; }
public float yCurveDeriv(float t) { return 1.5 - 3.0 * t + 3.0 * t * t; }

// Perpendicular coverage cx for a fill fragment at screen X `x`. `edge0`/`edge1`
// are the two ribbon edges at this y (screen X); `pf0`/`pf1` are EACH edge's own
// slope foreshortening (sqrt(1+slope²) of that edge's tangent, not the
// centerline's). `fadeApplies` is the caller's answer to "is this a fadeable BASE
// ribbon" — see thinWidthFade for why that decision is passed rather than
// re-derived from the kind here.
//
// Using per-edge slopes is the fix for boundary fuzz on curved ribbons: the old
// model measured distance from the centerline with one shared perpFactor, but
// where the two edges diverge in slope — a width-changing / concave-neck region
// — that shared slope is wrong for both edges, so the smoothstep transition
// smeared across many px (visibly fuzzy in transparent mode; hidden behind the
// opaque base in colored mode). Measuring each edge's own signed perpendicular
// distance keeps the transition ~1px on both edges regardless of curvature.
float perpCoverage(float x, float edge0, float edge1, float pf0, float pf1,
                   bool fadeApplies, float aaHalf) {
  float xL = min(edge0, edge1);
  float xR = max(edge0, edge1);
  float pfL = (edge0 <= edge1) ? pf0 : pf1;
  float pfR = (edge0 <= edge1) ? pf1 : pf0;
  // Signed perpendicular distance (screen px) inward from each edge.
  float dL = (x - xL) / pfL;
  float dR = (xR - x) / pfR;
  // Perpendicular (visual) width, averaging the two edge foreshortenings.
  float perpW = (xR - xL) / (0.5 * (pfL + pfR));
  // 1px minimum footprint: push both edges outward for a sub-pixel-thin ribbon
  // so it stays a locatable ~1px band rather than dropping between samples.
  // Wide ribbons (perpW >= 1) are unaffected.
  float expand = max(0.5 - 0.5 * perpW, 0.0);
  dL += expand;
  dR += expand;
  // Density-honest sub-pixel fade, BASE ribbons only — see thinWidthFade. The
  // per-fragment perpW here and the whole-ribbon one Canvas2D measures from the
  // corners are deliberately different quantities; the fade curve applied to
  // them is not, so only that is shared.
  float widthFade = thinWidthFade(perpW, fadeApplies);
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

FillEdges fillEdges(float4 c, float s, float sd, float dydt) {
  float2 e = ribbonEdges(c, s);
  // Each edge's own dx/dy: its total travel scaled by this point's ds/dy.
  float2 slope = ribbonEdgeDeltas(c) * (sd / max(abs(dydt), 1e-4));
  FillEdges o;
  o.edge0 = e.x;
  o.edge1 = e.y;
  o.pf0 = sqrt(1.0 + slope.x * slope.x);
  o.pf1 = sqrt(1.0 + slope.y * slope.y);
  return o;
}

// How far a fill is faded, and how much hover darkens it. These two scalars are
// the whole of what the Canvas2D twin has to reproduce from shadeFill below —
// the rest is the channel blend, and the two backends spell that in different
// spaces (0-1 floats here, 0-255 bytes inside an `rgba()` string there). Per
// adr-051 the exportable thing is the decision, not the conversion, so they are
// factored out here and lifted into TS by `//! js-export`.
//
// One expression covers both fill branches: BASE writes `fillShade` straight
// out as its alpha, CIGAR uses it as the white pre-blend factor. They were
// separately-spelled but identical before, which is exactly the shape that
// drifts.
//
// The cap is a cap on the BOOST, not on the alpha: `max(a, ...)` is what keeps
// hover from running backwards. Without it, the ×5/0.35 pair reduces the alpha of
// anything already above 0.35 — so with the opacity slider anywhere past that
// (it reaches 1.0; the default is 0.2), hovering made a ribbon the FAINTEST thing
// on screen instead of the most findable, and hoverDarken's 0.7 on the rgb could
// not make up for it. Below 0.35 the max is inert, so the low display alphas a
// whole-genome view actually uses are untouched.
//
// Rendered and measured, on a red ribbon over white: at the 0.2 default hovering
// gives (255,204,204) -> (228,166,166), and at 1.0 (255,0,0) -> (178,0,0), which
// is the strongest cue of any setting rather than the weakest as was once
// feared. The weak point is displayAlpha EXACTLY 0.35, where hovering lands on
// the same colour as hovering at 0.2 because both clamp here: the un-hovered
// ribbon has already reached the alpha the boost would take it to, so only
// hoverDarken is left and one channel moves 27/255. Still visible, and a narrow
// band, so it is left alone — but that is the opacity to look at if this is ever
// revisited. `browser-tests/hover-probe.ts` renders it.
public float fillShade(float colorAlpha, float displayAlpha, bool isHovered) {
  float a = colorAlpha * displayAlpha;
  return isHovered ? max(a, min(a * 5.0, 0.35)) : a;
}

public float hoverDarken(bool isHovered) { return isHovered ? 0.7 : 1.0; }

// Fill fragment output: feature color with hover darkening + alpha boost, with
// coverage folded into the alpha (straight, not premultiplied — the HAL's
// default blend is src-alpha / one-minus-src-alpha).
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
  float shade = fillShade(color.a, u.alpha, isHovered);
  float darken = hoverDarken(isHovered);
  if (isCigarKind(kind)) {
    // Pre-blend with white so the indel fades against white regardless of what
    // the base block drew, at the same alpha the BASE branch would have used.
    // Darkening applies inside the blend — darken first, then blend with white
    // — so the hovered color matches what the pre-shader renderer produced.
    rgb = rgb * darken * shade + float3(1.0, 1.0, 1.0) * (1.0 - shade);
    return float4(rgb, color.a * coverage);
  }
  return float4(rgb * darken, shade * coverage);
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
// Bounded by the MINIMUM horizontal width over `[s0, s1]`, the X-blend range the
// calling quad's own fragments span (see ribbonWidths, which is where the "only
// the two ends matter" argument lives), so a ribbon wider than perpFactor px
// gets no extra pad at all and the per-segment saving in syntenyFillCurve is
// untouched.
// SYNC: mirrored by `padExtra` in syntenyFillPad.test.ts.
public float thinRibbonPad(float perpFactor, float4 c, float s0, float s1) {
  float2 w = ribbonWidths(c, s0, s1);
  float wMin = w.x * w.y < 0.0 ? 0.0 : min(abs(w.x), abs(w.y));
  return max(perpFactor * 0.5 - 0.5 * wMin, 0.0);
}

// Float32 headroom on both pads below, and nothing else.
//
// It was 1.0, described as a fourth term for "AA fade at the boundary" — which
// term (1) already covers: the ramp is aaHalf = 0.5/dpr PERPENDICULAR px
// (aaHalfPx), maximal at dpr=1, and perpFactor·0.5 is exactly that projected
// onto x. `syntenyFillPad.test.ts` measures the two pads against the coverage
// footprint at every row of every shape it sweeps and the worst case comes out
// at exactly -slack, i.e. the whole pixel went unused in all of them. On the
// thin near-vertical ribbons a whole-genome view is mostly made of, 1px on each
// side of a ~2px-wide quad was most of what the rasterizer walked: dropping it
// to float slop cuts their rasterized area to 83.7% with the footprint still
// fully contained. The vertex pad and the fragment's edges are computed from the
// same float32 corners, so the two only disagree by arithmetic rounding, which
// at |x| ~ 4000px is ~1e-4.
static const float PAD_SLACK_PX = 0.25;

// The two ribbon edges at X-blend `s`, ordered left/right — they swap on a
// crossed "bowtie" ribbon, which is why the geometry sorts them here rather than
// assuming an order. Straight mode passes s=t, curve mode s=sBlend(t).
public float2 edgeSpan(float4 c, float s) {
  float2 e = ribbonEdges(c, s);
  return float2(min(e.x, e.y), max(e.x, e.y));
}

// Everything the two fill passes share. They differ only in geometry — one quad
// vs 8 tessellated bezier segments — so the varyings, the vertex prologue, and
// the whole fragment live here and each pass is left holding just its own
// polygon. Mirrors the rowRect module's split (render-core).
public struct FillVsOut {
  public float4 position : SV_Position;
  public float4 color    : COLOR0;
  public nointerpolation float featureId : COLOR1;
  // Per-instance corner positions in CSS-pixel screen X, exactly as
  // computeCorners produces them: (x, y) belong to the top view, (z, w) to the
  // bottom — i.e. x1..x4 in order.
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
                        out float4 c) {
  o.position = float4(0.0);
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;
  o.corners = float4(0.0);
  o.localPos = float2(0.0);
  o.kind = inst.kind;
  c = computeCorners(inst, u);
  if (isCulled(c, inst.alignmentLength, inst.kind, u)) {
    return false;
  }
  o.corners = c;
  return true;
}

// Vertex epilogue: place the vertex at screen (vx, yTop + y) and record the
// local position the fragment measures coverage from. Setting both here is what
// makes localPos.y affine in screen y with unit slope — the property
// fillFs's constant vertical AA relies on.
public void fillVsEmit(inout FillVsOut o, float vx, float y, Uniforms u) {
  o.localPos = float2(vx, y);
  o.position = screenToClip(float2(vx, u.yTop + y), u.resolution);
}

// The entire fill fragment. `s` is the pass's X-blend at this fragment, `sd`
// its ds/dt and `dydt` its dy/dt (straight: t, 1, height; curve: sBlend(t),
// sBlendDeriv(t), height·yCurveDeriv(t)). fillEdges turns those into each
// edge's own X and foreshortening.
//
// BASE ribbons and CIGAR indel tiles run the identical analytic per-edge AA, so
// both trace the smooth bezier edges with antialiased rather than stair-stepped
// sides. The ONLY thing the kind decides here is whether the density width-fade
// applies, which is what `fadeApplies` carries into perpCoverage.
public float4 fillFs(FillVsOut i, float s, float sd, float dydt, Uniforms u) {
  FillEdges e = fillEdges(i.corners, s, sd, dydt);
  float aaHalf = aaHalfPx(u);
  bool fadeApplies = !isCigarKind(i.kind) && !isMarkerKind(i.kind)
                  && u.fadeThinAlignments >= 0.5;
  float coverage =
    perpCoverage(i.localPos.x, e.edge0, e.edge1, e.pf0, e.pf1, fadeApplies,
                 aaHalf)
    * vertCoverage(i.localPos.y, u.height, aaHalf);
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
  // Capped at the ribbon's top and bottom by the SAME vertical AA fillFs
  // applies, so the outline ends exactly where the fill does.
  float alpha = band * vertCoverage(i.localPos.y, u.height, aaHalf)
              * STROKE_ALPHA;
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
public void straightGeometry(inout FillVsOut o, float4 c, uint vid,
                             float extraPerpPx, Uniforms u) {
  bool isTop = (vid == 0u || vid == 1u || vid == 4u);
  bool isRight = (vid == 1u || vid == 4u || vid == 5u);

  // The quad's two rows sit an AA pixel BEYOND each end of the ribbon (y = -1
  // and y = height + 1) so vertCoverage has somewhere to ramp, and the blend
  // extrapolates to match: s = -1/height at the top row, 1 + 1/height at the
  // bottom. In straight mode x is affine in t and t is affine in screen y, so
  // those two blends put the quad's sides exactly ON the ribbon's own edge
  // lines, offset by `pad`. Containment is then a property of `pad` alone, at
  // every row, with nothing left for the endpoints to get wrong.
  //
  // Holding the rows at s=0 and s=1 while moving them in y is what this
  // replaced, and it SHEARED the quad: the sides then ran over height+2 px of y
  // while the ribbon ran over height, so at y=0 the boundary already sat
  // ΔspanL/(height+2) along the ribbon's travel — up to a full perpendicular
  // pixel, which is the whole footprint. It ate the outer AA over roughly the
  // top and bottom quarter of every slanted ribbon (and, where the 1px minimum
  // footprint was the only thing drawing it, the ribbon): measured 11.5% of a
  // sub-pixel steep ribbon's total ink and 11.7% of a 3000px-run / 20px-tall
  // one, hard-cut rather than faded. syntenyFillPad.test.ts could not see it —
  // it modelled the quad as spanning exactly [y(t0), y(t1)] — and now models the
  // rows the shader actually emits.
  float dy = 1.0 / u.height;
  float sTop = -dy;
  float sBot = 1.0 + dy;
  // Ordered left/right, so a crossed ribbon still gets a forward-facing quad.
  float2 span = edgeSpan(c, isTop ? sTop : sBot);

  // Perpendicular pad (in horizontal pixels). Accommodates:
  //   (1) the AA ramp's perpendicular half-pixel: perpFactor·0.5.
  //   (2) perpCoverage's sub-pixel `expand`, via thinRibbonPad — zero for any
  //       ribbon wider than perpFactor px.
  //   (3) the caller's extraPerpPx, projected onto x at this slope.
  //
  // Term (1) scales with the slope of the STEEPER edge, not the centerline
  // average. The average under-pads whichever edge travels further on a
  // width-changing ribbon (measured: 0.94px of the AA ramp cropped on corners
  // (100, 900, 1200, 1180) at h=100, 4.5px on a crossed steep one), which is
  // the same reasoning that put maxEdgeDx in the curve pad below.
  //
  // CIGAR indel tiles use the same padded polygon as BASE — they share the
  // analytic edge + smoothstep AA path (fillFs), so their perpendicular
  // edges antialiase against the base block instead of stair-stepping.
  float2 d = ribbonEdgeDeltas(c);
  float slope = max(abs(d.x), abs(d.y)) / u.height;
  float perpFactor = sqrt(1.0 + slope * slope);
  float pad = perpFactor * (0.5 + extraPerpPx)
            + thinRibbonPad(perpFactor, c, sTop, sBot) + PAD_SLACK_PX;

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
public void curveGeometry(inout FillVsOut o, float4 c, uint vid,
                          float extraPerpPx, Uniforms u) {
  uint seg = vid / 6u;
  uint vertInSeg = vid % 6u;
  bool isTop = (vertInSeg == 0u || vertInSeg == 1u || vertInSeg == 4u);
  bool isRight = (vertInSeg == 1u || vertInSeg == 4u || vertInSeg == 5u);

  float invN = 1.0 / float(CURVE_SEGMENTS);
  float t0 = float(seg) * invN;
  float t1 = float(seg + 1u) * invN;
  float t = isTop ? t0 : t1;

  float s0 = sBlend(t0);
  float s1 = sBlend(t1);
  float2 span = edgeSpan(c, isTop ? s0 : s1);
  float y = u.height * yCurve(t);

  // The straight pass extrapolates its rows' blend to match their ±1px AA
  // offset; this one does not, and does not need to. The x-curve is momentarily
  // vertical at t=0 and t=1, so the first and last segment's rows barely move in
  // x — the shear that costs straight mode a perpendicular pixel is under
  // 0.26·Δ/h here against a pad of 0.28·Δ/h before the bulge term. Undoing it
  // would mean inverting yCurve per vertex, i.e. a Newton solve on all 48.
  //
  // Perpendicular pad (in horizontal pixels). Accommodates:
  //   (1) the AA ramp's perpendicular half-pixel: perpFactor·0.5, at THIS
  //       segment's steepest slope.
  //   (2) perpCoverage's sub-pixel `expand`, via thinRibbonPad — zero for any
  //       ribbon wider than perpFactor px, so it costs the common case nothing.
  //   (3) the caller's extraPerpPx, projected onto x at this segment's slope.
  //   (4) bezier bulge within the segment: max|s''|·dt²/8 in s-units, scaled
  //       by max edge Δ.
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
  float2 d = ribbonEdgeDeltas(c);
  float maxEdgeDx = max(abs(d.x), abs(d.y));
  // dx/dy = (Δ/h)·sBlendDeriv(t)/yCurveDeriv(t). That ratio is unimodal with
  // its peak of 2.0 at t=0.5, so its maximum over the segment is at whichever
  // in-range t sits closest to 0.5.
  float tPeak = clamp(0.5, t0, t1);
  float segSlope = maxEdgeDx / u.height * sBlendDeriv(tPeak)
                 / yCurveDeriv(tPeak);
  float perpFactor = sqrt(1.0 + segSlope * segSlope);
  float bulgeX = maxEdgeDx * invN * invN * 0.75;
  float pad = perpFactor * (0.5 + extraPerpPx)
            + thinRibbonPad(perpFactor, c, s0, s1) + bulgeX + PAD_SLACK_PX;

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

// Coverage at the ribbon's top and bottom cuts: one output pixel of AA at each.
// Both vertex shaders set localPos.y = screenY - u.yTop exactly, so localPos.y
// is affine in screen y with unit slope — the ramp is aaHalf wide by
// construction, no derivative to take.
//
// Shared by fillFs and strokeFs rather than spelled in both: the outline
// has to end exactly where the fill does, and two copies of the same two
// smoothsteps is precisely the shape that drifts.
public float vertCoverage(float yLocal, float h, float aaHalf) {
  return smoothstep(-aaHalf, aaHalf, yLocal)
       - smoothstep(h - aaHalf, h + aaHalf, yLocal);
}

// ---------------------------------------------------------------------------
// Corners -> edges. The one statement of which corner belongs to which ribbon
// edge, and the two quantities derived from it.
// ---------------------------------------------------------------------------

// The two ribbon edges at X-blend `s`, as (edge0, edge1) and NOT sorted — they
// swap on a crossed "bowtie" ribbon, which is what edgeSpan's min/max is for.
// Straight mode passes s=t, curve mode s=sBlend(t).
//
// Edge 0 runs x1 -> x4, edge 1 runs x2 -> x3. That pairing used to be written
// twice — here for the vertex polygon and again inside fillEdges for the
// fragment's analytic clip — and the two have to agree or the geometry crops the
// shape the fragment draws. Nothing would have caught them diverging:
// syntenyFillPad.test.ts builds its model polygon from its own copy of
// fillEdges, so it assumes the agreement instead of checking it. Stating the
// pairing once removes the question.
float2 ribbonEdges(float4 c, float s) {
  return float2(lerp(c.x, c.w, s), lerp(c.y, c.z, s));
}

// Each edge's total top-to-bottom travel in x: (x4-x1, x3-x2). Taken as the
// difference of the two endpoints ribbonEdges itself reports, which is exact
// (lerp at s=1 minus lerp at s=0) and keeps the pairing above the only place a
// corner is matched to an edge.
float2 ribbonEdgeDeltas(float4 c) {
  return ribbonEdges(c, 1.0) - ribbonEdges(c, 0.0);
}

// The ribbon's SIGNED horizontal width at two X-blend values, as (w(s0), w(s1)).
// Signed on purpose — opposite signs mean the edges cross, so the width passes
// through zero somewhere between, which is the bowtie case thinRibbonPad has to
// pad for. Width is edge1 - edge0 = lerp(x2-x1, x3-x4, s), affine in s, so these
// two ends bound it everywhere between and no interior sample is needed.
//
// The blends are the CALLER'S, not 0 and 1, because a quad has to be padded for
// the widths its own fragments see and no others. Straight mode's rows sit an AA
// pixel beyond each end (s slightly outside [0,1]); a curve segment sees only
// its own slice. Reading the whole ribbon for both under-padded the first and
// over-padded the second.
float2 ribbonWidths(float4 c, float s0, float s1) {
  float2 a = ribbonEdges(c, s0);
  float2 b = ribbonEdges(c, s1);
  return float2(a.y - a.x, b.y - b.x);
}
