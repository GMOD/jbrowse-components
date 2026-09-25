// The row axis resolved on the GPU. An instance carries a stable row KEY in its
// `row` lane, and the pass binds a table mapping each key to the slot it is
// drawn on, or to hidden, with an optional colour override — so a reorder, a
// focus, a hide or a recolour uploads this table and no instance bytes, the
// property a y domain already has as a uniform (GRAMMAR_OF_GRAPHICS.md, rule 3).
//
// The table is an RGBA8 texture of two planes, one texel per key, keys wrapped
// onto rows of ROW_TABLE_MAX_WIDTH past it (the WebGL2 floor on a texture
// dimension). The slot plane holds the slot's low 24 bits in rgb and 255 in
// alpha where the key is drawn, 0 where it is hidden; the colour plane below it
// holds the override, straight alpha, and alpha 0 where the instance keeps its
// own colour. `marks/rowTable.ts` writes it through the texel twins exported
// here, and is the painter's and hit test's reading of the same bytes.
//
// Sampled at texel centres with `SampleLevel`, never `Load`: this slangc emits
// `textureLoad` on the sampler variable for `Load`, which is invalid WGSL. The
// texel index arithmetic is unsigned and the sampler is `nearest`, so the
// read-back is the byte the builder wrote. A module can take a sampler as a
// parameter but not declare the binding for its importer, so each pass reading
// a table declares its own `[[vk::binding(2, 0)]] Sampler2D<float4>`.
//! export-consts: ROW_TABLE_MAX_WIDTH
//! js-export: rowTableWidth, rowTablePlaneHeight, rowTableTexelX, rowTableTexelY
//! js-skip: byteOf — recovers a byte from a sampled texel; the TS side reads the table's bytes directly
module rowTable;

public static const uint ROW_TABLE_MAX_WIDTH = 2048u;

public struct RowPlacement {
  public bool hidden;
  public uint slot;
  public float4 color;
};

public uint rowTableWidth(uint keys) {
  return max(min(keys, ROW_TABLE_MAX_WIDTH), 1u);
}

public uint rowTablePlaneHeight(uint keys) {
  uint w = rowTableWidth(keys);
  return max((keys + w - 1u) / w, 1u);
}

public uint rowTableTexelX(uint key, uint keys) {
  return key % rowTableWidth(keys);
}

// The key's row in the slot plane; the colour plane's is one plane height on.
public uint rowTableTexelY(uint key, uint keys) {
  return key / rowTableWidth(keys);
}

uint byteOf(float channel) {
  return uint(channel * 255.0 + 0.5);
}

// The key's placement: its slot and colour through the table of `keys` keys,
// or the identity — its `row` as the slot, its own colour — where `keys` is
// negative, which is what a pass with no table binds.
public RowPlacement rowTableLookup(
  Sampler2D<float4> table, uint key, int keys, float4 own
) {
  RowPlacement p;
  p.hidden = false;
  p.slot = key;
  p.color = own;
  if (keys < 0) {
    return p;
  }
  uint n = uint(keys);
  if (key >= n) {
    p.hidden = true;
    return p;
  }
  uint h = rowTablePlaneHeight(n);
  float u = (float(rowTableTexelX(key, n)) + 0.5) / float(rowTableWidth(n));
  float rows = float(2u * h);
  uint y = rowTableTexelY(key, n);
  float4 s = table.SampleLevel(float2(u, (float(y) + 0.5) / rows), 0.0);
  if (s.a < 0.5) {
    p.hidden = true;
    return p;
  }
  p.slot = byteOf(s.r) | (byteOf(s.g) << 8) | (byteOf(s.b) << 16);
  float4 c = table.SampleLevel(float2(u, (float(y + h) + 0.5) / rows), 0.0);
  p.color = c.a > 0.0 ? c : own;
  return p;
}
