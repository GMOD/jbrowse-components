// Per-instance layout shared by line and chevron. Chevron draws from line's
// vertex buffer, so both must declare identical attribute locations and types.
module lineInstance;

public struct LineInstance {
  public uint2 startEnd  : ATTR0;
  public float y         : ATTR1;
  public float direction : ATTR2;
  public uint  color     : ATTR3;
};
