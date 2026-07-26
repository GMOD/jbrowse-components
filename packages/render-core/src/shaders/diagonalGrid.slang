// Shared 45°-rotated contact-grid transform. The Hi-C contact map and the LD
// heatmap both lay cells out as squares rotated 45° above the x-axis and then
// place them with the same (viewScale, viewOffsetX, yScalar) triple, so the
// rotation factor and the transform live here instead of being re-spelled — and
// eventually drifting — in two plugins.
//
// Imported via `import diagonalGrid;`.
module diagonalGrid;

import hpmath;

// cos(45°) = sin(45°).
static const float ROT_45 = 0.7071067811865476;

// Grid-space cell corner → clip space. `pos` is in the caller's grid units
// (genomic bp for Hi-C, cell pitch for the LD uniform grid).
public float4 diagonalCellToClip(
  float2 pos, float2 canvasSize, float viewScale, float viewOffsetX, float yScalar
) {
  float rx = (pos.x + pos.y) * ROT_45;
  float ry = (-pos.x + pos.y) * ROT_45;
  float2 screen = float2(rx * viewScale + viewOffsetX, ry * viewScale * yScalar);
  return screenToClip(screen, canvasSize);
}
