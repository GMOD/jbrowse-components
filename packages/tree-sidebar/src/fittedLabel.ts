import { measureText } from '@jbrowse/core/util'

/** `label` if it fits in `room` px, else its longest prefix that fits with an ellipsis. */
export function fittedLabel(
  label: string,
  room: number,
  fontSize: number,
  fontFamily?: string,
) {
  if (measureText(label, fontSize, fontFamily) <= room) {
    return label
  }
  for (let n = label.length - 1; n > 0; n--) {
    const cut = `${label.slice(0, n).trimEnd()}…`
    if (measureText(cut, fontSize, fontFamily) <= room) {
      return cut
    }
  }
  return ''
}
