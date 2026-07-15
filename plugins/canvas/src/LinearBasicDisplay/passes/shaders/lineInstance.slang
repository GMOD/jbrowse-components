// Shared per-instance layout for line and chevron shaders — chevron re-reads
// the same vertex buffer as line (drawPass(chevron, region, bufferPassId=line)),
// so both must declare identical attribute locations and types.
module lineInstance;

public struct LineInstance {
  public uint2 startEnd  : ATTR0;
  public float y         : ATTR1;
  public float direction : ATTR2;
  public uint  color     : ATTR3;
  // Box height this line/chevron rides on, so it can snap onto the box's drawn
  // center row (snapBoxCenterY) rather than ~1px off in odd-height modes.
  public float height    : ATTR4;
};
