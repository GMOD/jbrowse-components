import type { Entry } from './parseArgv.ts'

// Batch rendering: one image per junction in a BEDPE, so reviewing a callset is
// a directory of pictures rather than N trips through the browser.
//
// BEDPE and not VCF, deliberately. Every caller's BND spelling is a parsing job
// this tool has no business growing — the brackets, the inserted sequence, the
// symbolic ALTs, the mate conventions — and `scripts/sv_multihop.py bedpe`
// already does it, against the same parser the multi-hop tutorial uses. BEDPE is
// also what a LINX/GRIDSS TSV converts to, so one input format covers every
// producer without this file learning any of their dialects.

export interface BedpeRecord {
  refName1: string
  start1: number
  end1: number
  refName2: string
  start2: number
  end2: number
  name?: string
}

/**
 * Parse a BEDPE. Blank lines, `#` comments and `track`/`browser` lines are
 * skipped, as are rows whose coordinates are the BEDPE null marker (`-1`) or
 * unparseable — a callset with a single-breakend row should render the rest
 * rather than abort at row 400.
 *
 * Returns the rows AND the reasons rows were dropped, because a batch run that
 * silently produced 380 images from a 400-row file is exactly the failure this
 * whole workflow exists to avoid.
 */
export function parseBedpe(text: string) {
  const records: BedpeRecord[] = []
  const skipped: string[] = []
  let lineNo = 0
  for (const rawLine of text.split('\n')) {
    lineNo++
    const line = rawLine.trim()
    if (
      !line ||
      line.startsWith('#') ||
      line.startsWith('track') ||
      line.startsWith('browser')
    ) {
      continue
    }
    const f = line.split('\t')
    if (f.length < 6) {
      skipped.push(`line ${lineNo}: needs 6 columns, got ${f.length}`)
      continue
    }
    const [refName1, s1, e1, refName2, s2, e2, name] = f
    const start1 = Number(s1)
    const end1 = Number(e1)
    const start2 = Number(s2)
    const end2 = Number(e2)
    if (
      ![start1, end1, start2, end2].every(n => Number.isFinite(n) && n >= 0)
    ) {
      // `-1` in all four is BEDPE's own "unknown", which is what a single
      // breakend looks like here: there is no second locus to draw a panel on.
      skipped.push(`line ${lineNo}: no usable coordinate pair`)
      continue
    }
    records.push({
      refName1: refName1!,
      start1,
      end1,
      refName2: refName2!,
      start2,
      end2,
      ...(name && name !== '.' ? { name } : {}),
    })
  }
  return { records, skipped }
}

/**
 * The window each panel opens on: the junction's own interval grown by `flank`
 * on each side.
 *
 * A caller's breakend interval is usually one base (or a confidence interval a
 * few bases wide), which would render as a panel zoomed past any useful scale,
 * so the flank is what actually decides the picture. Clamped at 0 because a
 * breakend near the start of a chromosome would otherwise ask for a negative
 * coordinate, which no locstring parses.
 */
export function panelLoc(
  refName: string,
  start: number,
  end: number,
  flank: number,
) {
  const lo = Math.max(0, start - flank)
  return `${refName}:${lo + 1}-${end + flank}`
}

/** The two `--loc` values one BEDPE row renders as, in file order. */
export function recordLocs(rec: BedpeRecord, flank: number) {
  return [
    panelLoc(rec.refName1, rec.start1, rec.end1, flank),
    panelLoc(rec.refName2, rec.start2, rec.end2, flank),
  ]
}

/**
 * A filename for one record, unique within the run.
 *
 * The index leads, so the directory sorts in callset order and a reviewer can
 * walk it in the order the caller ranked things. The coordinates follow because
 * the name column is optional and, when present, is frequently a caller's
 * internal id (`SV_20`) that says nothing about where it is — the point of a
 * contact sheet being that you can find the one you are looking at.
 *
 * `padStart` on the index, so 10 sorts after 9 in any file browser.
 *
 * The whole basename is sanitized, not just the name column. A refName is no
 * safer than a caller's label — `GL000/1` builds a path into a directory that
 * does not exist, and the record fails at write time having already paid for its
 * render.
 */
export function outputName(
  rec: BedpeRecord,
  idx: number,
  total: number,
  ext: string,
) {
  const num = String(idx + 1).padStart(String(total).length, '0')
  const label = rec.name ? `_${rec.name}` : ''
  const base = `${num}_${rec.refName1}_${rec.start1}-${rec.refName2}_${rec.start2}${label}`
  return `${base.replaceAll(/[^\w.-]+/g, '-')}.${ext}`
}

/**
 * The argv entries one record contributes: a `--loc` per panel.
 *
 * Built as parsed entries rather than a command string because the batch runs
 * in-process — the module graph is loaded once for the whole callset instead of
 * once per variant, which for a few hundred rows is the difference between a
 * coffee and a lunch.
 */
export function recordArgv(rec: BedpeRecord, flank: number): Entry[] {
  return recordLocs(rec, flank).map(loc => ['loc', [loc]])
}
