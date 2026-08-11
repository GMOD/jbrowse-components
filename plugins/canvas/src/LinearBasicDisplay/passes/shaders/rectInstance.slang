// Shared per-instance layout for the rect and continuation shaders —
// continuation re-reads the same vertex buffer as rect
// (drawPass(continuation, region, bufferPassId=rect)), so both must declare
// identical attribute locations and types. Same arrangement as
// lineInstance.slang, which line and chevron share.
//
// The two consumers read overlapping-but-different subsets, and each ignores
// one field: rect never reads `strand`, continuation never reads `densityFade`.
// That is cheaper than it looks — one 28-byte instance instead of two 24-byte
// ones — and it is what removes the second full per-region pack + upload the
// continuation pass used to need (GpuCanvasFeatureRenderer).
module rectInstance;

public struct RectInstance {
  public uint2 startEnd : ATTR0;
  public float y        : ATTR1;
  public float height   : ATTR2;
  public uint  color    : ATTR3;
  // 1 = collapsed row-0 box sharing pixels with another collapsed box — only
  // these fade; 0 = anything else — a gene subfeature rect, a stacked box, or a
  // collapsed mark with room around it — stays opaque. Read by rect, ignored by
  // continuation.
  public uint  densityFade : ATTR4;
  // Genomic strand (-1, 0 or +1) so the continuation markers can point the way
  // the feature runs; 0 falls back to outward arrows. Read by continuation,
  // ignored by rect.
  public float strand   : ATTR5;
};
