// ColorPicker's preset grid
export const swatchStyle = {
  width: 24,
  height: 24,
  margin: 4,
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  outline: 'none',
} as const

/** PopoverPicker's trigger, small enough to sit inside a table row */
export function triggerSwatchStyle(borderColor: string) {
  return {
    width: 16,
    height: 16,
    margin: 4,
    boxSizing: 'border-box',
    border: `1px solid ${borderColor}`,
  } as const
}
