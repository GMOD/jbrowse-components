// oxfmt wraps prose at 80 columns, so a bold menu path can start on one line
// and close on the next. A line whose `**` marks don't pair takes the lines
// after it, up to a blank line or a fence, until they do; every other line
// stays as it is, so a check reading these sees the same lines it always did
// plus the wrapped path whole. Fenced lines are never joined: `f(**kwargs)`
// would otherwise swallow the closing fence.

import { FENCE, fencedLines } from './docFenceRegions.ts'

export interface LogicalLine {
  /** 0-based index of the first physical line */
  line: number
  text: string
}

const unpaired = (text: string) => (text.match(/\*\*/g) ?? []).length % 2 === 1

export function unwrapBold(text: string): LogicalLine[] {
  const lines = text.split('\n')
  const fenced = fencedLines(lines)
  const out: LogicalLine[] = []
  for (let i = 0; i < lines.length; i++) {
    const start = i
    let joined = lines[i]!
    if (!fenced[i]) {
      while (
        unpaired(joined) &&
        i + 1 < lines.length &&
        lines[i + 1]!.trim() !== '' &&
        !FENCE.test(lines[i + 1]!)
      ) {
        i++
        joined = `${joined} ${lines[i]!.trim()}`
      }
    }
    out.push({ line: start, text: joined })
  }
  return out
}
