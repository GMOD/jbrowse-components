import {
  axisOf,
  displayArg,
  engineDisplay,
  engineResult,
  readerCall,
} from './engineToR.ts'
import { expr, jbrowseLayer, rStr } from './rplot.ts'

import type { EngineSource } from './engineToR.ts'
import type { Panel, Region } from './rScript.ts'
import type { Plot } from './rplot.ts'

/** The slice of a resolved LinearAlignmentsDisplay config that composes the figure. */
export interface AlignmentsDisplaySnapshot {
  /** The display's `color` object, or the plain fill as a string. */
  color?: string | Record<string, unknown>
  facet?: unknown
  readConnections?: string
  showCoverage?: boolean
  showMismatches?: boolean
  showPileup?: boolean
  showSashimiArcs?: boolean
  minSashimiScore?: number
  coverageSnpMinFrequency?: number
  fadeLowFrequencyMismatches?: boolean
  [slot: string]: unknown
}

/** Where a base is wide enough on the figure to write its letter, as ggjbrowse's autoplot writes them. */
const LETTERS_MAX_BP = 300

/** What the engine paints that the figure's key cannot show. */
function colorNotes(color: AlignmentsDisplaySnapshot['color']) {
  const { field, scale } = typeof color === 'object' ? color : {}
  if (!field || scale === 'none') {
    return []
  }
  if (scale === 'linear') {
    return [
      `color: a linear ramp over ${field} keys no legend; each read still fills in its own color`,
    ]
  }
  if (field === 'mateRefName') {
    return [
      'color: mateRefName colors each contig by its hash, where the browser orders them by the assembly',
    ]
  }
  return []
}

/**
 * A LinearAlignmentsDisplay as the bands it stacks, each a ggplot of
 * ggjbrowse geoms over one `jbrowse_alignments()` result: splice-junction
 * arcs where the reads splice, the coverage band with its allele stacks, the
 * read-connection band where the display draws one, and the pileup. The
 * display's own settings go to the engine as the config writes them, so each
 * read comes back on the row the browser packs it onto, in the color it
 * paints it, under the browser's key.
 */
export function alignmentsPanels({
  display,
  written,
  source,
  regions,
  reference,
  key,
  aliases,
  bpPerPx,
}: {
  /** The resolved config, whose defaults decide which bands draw. */
  display: AlignmentsDisplaySnapshot
  /** The config as written, its defaults left out, which the engine takes. */
  written: Record<string, unknown>
  source: EngineSource
  regions: readonly Region[]
  /** Suffixes every R name, so several alignments tracks share one script. */
  key?: string
  /** Canonical refName to the name the file spells it with, where they differ. */
  aliases?: Record<string, string>
  /** The assembly's FASTA or 2bit, which a CRAM decodes against and a read with no MD tag is compared against. */
  reference?: string
  bpPerPx: number
}): { panels: Panel[]; notes: string[] } {
  const named = (name: string) => (key ? `${name}_${key}` : name)
  const aliased = Object.keys(aliases ?? {}).length > 0
  const aln = engineResult({
    name: named('aln'),
    regions,
    aliases,
    bpPerPx,
    call: span =>
      readerCall('alignments', [
        source.file,
        span.chrom,
        span.start,
        span.end,
        ...(reference ? [`reference = ${rStr(reference)}`] : []),
        ...(reference && aliased ? [`reference_chrom = ${span.refChrom}`] : []),
        ...(source.index ? [`index = ${rStr(source.index)}`] : []),
        ...displayArg(engineDisplay(written)),
      ]),
  })
  const a = aln.name
  const { xlim, xLabel } = axisOf(regions)
  const sectioned = display.facet !== undefined
  const fade = {
    ...(display.fadeLowFrequencyMismatches === false ? { fade: false } : {}),
    px_per_bp: Number((1 / bpPerPx).toPrecision(6)),
  }
  const minReads = display.minSashimiScore ?? 2
  const band = (variable: string, plot: Plot, heightWeight: number) => ({
    variable: named(variable),
    plot: { xlim, labs: { x: null, y: null }, ...plot },
    heightWeight,
  })
  const panels: Panel[] = []
  const notes: string[] = []
  if (display.showCoverage !== false) {
    if (display.showSashimiArcs !== false) {
      panels.push({
        ...band(
          'junctions',
          {
            layers: [
              jbrowseLayer('junctions', aln, { min_reads: minReads }),
              jbrowseLayer('junction_counts', aln, { min_reads: minReads }),
            ],
            scales: { colour: { kind: 'jbrowse', of: aln, key: 'junctions' } },
            ylim: { min: 0, max: 1.08 },
            facetBy: sectioned
              ? { field: 'section', rows: 'shared' }
              : undefined,
            hideY: true,
          },
          0.5,
        ),
        when: `any(${a}$junctions$count >= ${minReads})`,
      })
    }
    panels.push(
      band(
        'coverage',
        {
          layers: [
            jbrowseLayer('coverage', aln),
            jbrowseLayer('alleles', aln, {
              min_allele_frequency: display.coverageSnpMinFrequency ?? 0,
            }),
            jbrowseLayer('modification_coverage', aln),
          ],
          scales: { colour: { kind: 'jbrowse', of: aln, key: 'bases' } },
          expandY: 0,
          facetBy: sectioned ? { field: 'section', rows: 'free' } : undefined,
          labs: { x: null, y: 'depth' },
        },
        0.6,
      ),
    )
  }
  const connections = display.readConnections
  if (connections === 'arc' || connections === 'cloud') {
    const cloud = connections === 'cloud'
    panels.push(
      band(
        'connections',
        {
          layers: [jbrowseLayer('arc_ticks', aln), jbrowseLayer('arcs', aln)],
          scales: {
            colour: { kind: 'jbrowse', of: aln, key: 'arcs' },
            y: { kind: cloud ? 'log' : 'reverse' },
          },
          ylim: cloud
            ? { min: 1, max: expr(`max(2, ${a}$arc_span_max)`) }
            : { min: 0, max: expr(`max(1, ${a}$arcs$y)`) },
          facetBy: sectioned ? { field: 'section', rows: 'shared' } : undefined,
          labs: { x: null, y: cloud ? 'insert size (bp)' : null },
          hideY: !cloud,
        },
        0.6,
      ),
    )
  }
  if (display.showPileup !== false) {
    const mismatches = display.showMismatches !== false
    const span = regions.reduce((sum, r) => sum + r.end - r.start, 0)
    panels.push(
      band(
        'pileup',
        {
          layers: [
            jbrowseLayer('reads', aln),
            jbrowseLayer('skips', aln),
            jbrowseLayer('deletions', aln, fade),
            jbrowseLayer('modifications', aln),
            ...(mismatches
              ? [
                  jbrowseLayer('mismatches', aln, fade),
                  jbrowseLayer('insertions', aln, fade),
                  jbrowseLayer('clips', aln, fade),
                ]
              : []),
            ...(mismatches && span <= LETTERS_MAX_BP
              ? [jbrowseLayer('letters', aln)]
              : []),
          ],
          scales: {
            fill: { kind: 'jbrowse', of: aln, key: 'reads' },
            ...(mismatches
              ? { colour: { kind: 'jbrowse', of: aln, key: 'bases' } as const }
              : {}),
            y: { kind: 'reverse' },
          },
          facetBy: sectioned ? { field: 'section', rows: 'sized' } : undefined,
          hideY: true,
        },
        2,
      ),
    )
    notes.push(...colorNotes(display.color))
    if (mismatches && !reference) {
      notes.push(
        'mismatches: a read with no MD tag draws no mismatches, since no reference was given',
      )
    }
  }
  const last = panels.at(-1)
  if (last) {
    last.plot.labs = { ...last.plot.labs, x: xLabel }
  }
  return { panels, notes }
}
