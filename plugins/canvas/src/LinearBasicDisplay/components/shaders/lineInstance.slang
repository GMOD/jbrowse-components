// Shared per-instance layout for line and chevron shaders — chevron re-reads
// the same vertex buffer as line (drawPass(chevron, region, bufferPassId=line)),
// so both must declare identical attribute locations and types.
module lineInstance;

public struct LineInstance {
  public uint2 startEnd  : ATTR0;
  public float y         : ATTR1;
  public float direction : ATTR2;
  public uint  color     : ATTR3;
};
