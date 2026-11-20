import { measureText } from '../util/measureText.ts'

// measureText reads a Helvetica table, and what a key's labels draw in is
// usually wider: Roboto on screen, and in an export whatever face its family
// resolves to (Noto and DejaVu are the common sans-serif and serif faces). Scale
// the estimate up before sizing the paper behind a label, or it clips.
const WIDER_FACE_RATIO = 1.1

/**
 * A key label's width at `fontSize`, in the export's `fontFamily` when it has
 * one and the app's font otherwise.
 */
export function measureLegendText(
  str: string,
  fontSize: number,
  fontFamily?: string,
) {
  return measureText(str, fontSize, fontFamily) * WIDER_FACE_RATIO
}
