// Per-instance layout shared by rect and continuation. Continuation draws from
// rect's vertex buffer, so both must declare identical attribute locations and
// types; lineInstance.slang does the same for line and chevron.
//
// Each pass ignores one field, rect `strand` and continuation `densityFade`. One
// 28-byte instance spares continuation a second per-region pack and upload.
module rectInstance;

public struct RectInstance {
  public uint2 startEnd : ATTR0;
  public float y        : ATTR1;
  public float height   : ATTR2;
  public uint  color    : ATTR3;
  // 1 for a collapsed row-0 box sharing pixels with others, which fades; 0 for
  // everything else, which stays opaque.
  public uint  densityFade : ATTR4;
  // Genomic strand (-1, 0 or +1), which the continuation markers point along; 0
  // points them out of the edge.
  public float strand   : ATTR5;
};
