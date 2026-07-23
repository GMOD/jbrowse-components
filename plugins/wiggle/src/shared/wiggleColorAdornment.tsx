// Read-only color readout for the "Edit color..." track-menu row: a solid chip,
// or a vertical pos-over-neg split matching the way bicolor scores grow up and
// down from the pivot. Mirrors the effective-color logic in gpuProps — density
// mode ignores the single `color` and ramps from posColor — so the menu never
// advertises a color the plot isn't using.
function ColorSwatch({
  posColor,
  negColor,
}: {
  posColor: string
  negColor?: string
}) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: 2,
        border: '1px solid rgba(0,0,0,0.3)',
        background:
          negColor === undefined
            ? posColor
            : `linear-gradient(to bottom, ${posColor} 50%, ${negColor} 50%)`,
      }}
    />
  )
}

export function wiggleColorAdornment(self: {
  color: string
  posColor: string
  negColor: string
  useBicolor: boolean
  isDensityMode: boolean
}) {
  return self.useBicolor ? (
    <ColorSwatch posColor={self.posColor} negColor={self.negColor} />
  ) : (
    <ColorSwatch posColor={self.isDensityMode ? self.posColor : self.color} />
  )
}
