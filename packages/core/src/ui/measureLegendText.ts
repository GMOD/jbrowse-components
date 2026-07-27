import { measureText } from '../util/index.ts'

// measureText uses a Helvetica width table, but SVG legend <text> nodes have no
// font-family and render in the wider app font (Roboto), so scale the estimate
// up before sizing the white paper behind a label or it clips.
const APP_FONT_WIDTH_RATIO = 1.1

export function measureLegendText(str: string, fontSize: number) {
  return measureText(str, fontSize) * APP_FONT_WIDTH_RATIO
}
