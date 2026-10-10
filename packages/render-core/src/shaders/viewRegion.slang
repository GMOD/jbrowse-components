// A displayed region as the view-spanning marks (`link`, `connector`) place a
// bp through it. The table entry is (anchorPx, anchorBpHi, anchorBpLo,
// signedPxPerBp): an anchor bp near the view, split so a foot's offset from it
// stays inside float32 at any chromosome position.
module viewRegion;

import hpmath;

public static const uint VIEW_REGION_MAX = 256u;

public float viewRegionPx(uint bp, float4 r, float hpZero) {
  return r.x - hpViewportOffsetBp(hpSplitUint(bp), float3(r.y, r.z, 0.0), hpZero) * r.w;
}
