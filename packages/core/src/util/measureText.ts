// prettier-ignore
const widths = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.2796875,0.2765625,0.3546875,0.5546875,0.5546875,0.8890625,0.665625,0.190625,0.3328125,0.3328125,0.3890625,0.5828125,0.2765625,0.3328125,0.2765625,0.3015625,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.2765625,0.2765625,0.584375,0.5828125,0.584375,0.5546875,1.0140625,0.665625,0.665625,0.721875,0.721875,0.665625,0.609375,0.7765625,0.721875,0.2765625,0.5,0.665625,0.5546875,0.8328125,0.721875,0.7765625,0.665625,0.7765625,0.721875,0.665625,0.609375,0.721875,0.665625,0.94375,0.665625,0.665625,0.609375,0.2765625,0.3546875,0.2765625,0.4765625,0.5546875,0.3328125,0.5546875,0.5546875,0.5,0.5546875,0.5546875,0.2765625,0.5546875,0.5546875,0.221875,0.240625,0.5,0.221875,0.8328125,0.5546875,0.5546875,0.5546875,0.5546875,0.3328125,0.5,0.2765625,0.5546875,0.5,0.721875,0.5,0.5,0.5,0.3546875,0.259375,0.353125,0.5890625]
const avgWidth = 0.5279276315789471

// Advance width of one monospace glyph, in em — the same for every character,
// which is what makes the table above unusable for one: it is Helvetica, where
// `i` is 0.22em and `m` is 0.94em, so a monospace string of narrow letters
// measures far too small and one of wide letters far too large. The mainstream
// faces cluster tightly here (Courier and DejaVu Sans Mono 0.600, Menlo 0.602,
// Liberation Mono 0.600, Consolas 0.550), and rounding *up* is the safe
// direction for every caller: all of them measure to reserve room.
const MONOSPACE_EM = 0.61

// xref https://gist.github.com/tophtucker/62f93a4658387bb61e4510c37e2e97cf
//
// `fontFamily` is only consulted to pick monospace, which is a different metric
// rather than a different table. Proportional families are all measured against
// the Helvetica table: it is what the app renders in, and for the two other
// families the SVG export can be asked for it is close (system-ui) or narrower
// (serif, which over-reserves — the harmless direction).
export function measureText(str: unknown, fontSize = 10, fontFamily?: string) {
  const s = String(str)
  if (fontFamily?.includes('monospace')) {
    return s.length * MONOSPACE_EM * fontSize
  }
  let total = 0
  for (let i = 0, l = s.length; i < l; i++) {
    total += widths[s.charCodeAt(i)] ?? avgWidth
  }
  return total * fontSize
}
