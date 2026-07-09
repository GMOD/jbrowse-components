import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The population_genomics tutorial's figure: the windowed Fst + nucleotide
// diversity (pi) scans from the DGRP2 Drosophila panel, loaded as the exact
// multi-wiggle track the tutorial documents. Data is the real pipeline output
// hosted at jbrowse.org/demos/popgen (Fst of In(2L)t-inverted vs
// standard-arrangement lines, and whole-panel pi, both 10 kb windows).
//
// Loaded against the hosted UCSC dm6 hub config (jbrowse.org/ucsc/dm6) so the
// figure carries a real gene track for context and gene-name search — the setup
// the tutorial tells the reader to build. That assembly names arms chr2L etc.;
// the bigWigs name them 2L etc. (from the VCF header), and the hub assembly's
// RefNameAliasAdapter (chromAlias.txt) reconciles the two at display time, which
// is the aliasing the tutorial calls out.
const DM6_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/dm6/config.json')}`

// Two independent quantitative tracks rather than one shared-scale
// MultiQuantitativeTrack: Fst tops out near 0.83 and pi near 0.016, a ~50x gap,
// so stacking them into one multi-wiggle (which shares a single y-domain across
// its rows) would crush pi to a flat line. Separate tracks each auto-scale to
// their own data, so both signals read.
const FST_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'fst_in2lt',
  name: 'Fst (In(2L)t vs standard)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/fst_In2Lt.bw',
  },
}
const PI_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'pi_all',
  name: 'π (whole panel)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/pi_all.bw',
  },
}

export const popgenSpecs: ScreenshotSpec[] = [
  // Whole chromosome arm 2L: the In(2L)t Fst track (top) rises into an elevated
  // plateau across the inversion (~2.2–13.2 Mb) with breakpoint peaks — the
  // recombination-suppression footprint — and drops sharply back to background
  // past the distal breakpoint, over the pi track (bottom). No gene track:
  // individual genes are unreadable across a 23 Mb arm (they collapse to a "too
  // many features" band), and the two scans are the whole-arm story — gene
  // context (Cyp6g1) is a zoomed-in reading.
  {
    mode: 'url',
    name: 'popgen/fst_in2lt_2L',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [FST_TRACK, PI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          loc: 'chr2L',
          tracks: [
            {
              trackId: 'fst_in2lt',
              displaySnapshot: { type: 'LinearWiggleDisplay', height: 180 },
            },
            {
              trackId: 'pi_all',
              displaySnapshot: { type: 'LinearWiggleDisplay', height: 180 },
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: '[data-testid="wiggle-display-done"]',
    readyText: 'π (whole panel)',
    readyTimeout: 90000,
    // both 180px tracks plus headers clear the crop
    viewportHeight: 560,
    settleMs: 12000,
  },

  // Zoomed to the Cyp6g1 locus (chr2R:12,185,667–12,188,431): whole-panel pi
  // over the NCBI RefSeq genes. pi collapses into a sharp deep valley across
  // ~12.13–12.20 Mb (the gene's window drops to ~0.0004, under 10% of the 2R
  // average ~0.0049) between high-diversity flanks — the classic hard-sweep
  // signature of the DDT/neonicotinoid-resistance haplotype fixing in this
  // derived population. Genes are individually rendered and labeled at this
  // ~270 kb zoom, so Cyp6g1 can be pointed to directly.
  {
    mode: 'url',
    name: 'popgen/pi_cyp6g1',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [PI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          loc: 'chr2R:12,050,000-12,320,000',
          tracks: [
            {
              trackId: 'pi_all',
              displaySnapshot: { type: 'LinearWiggleDisplay', height: 200 },
            },
            'dm6-ncbiRefSeqCurated',
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: '[data-testid="wiggle-display-done"]',
    // waiting on the gene label also confirms the annotation's text anchor is
    // present before capture
    readyText: 'Cyp6g1',
    readyTimeout: 90000,
    viewportHeight: 560,
    settleMs: 12000,
    annotations: [
      { type: 'box', anchor: { text: 'Cyp6g1' } },
      {
        type: 'text',
        anchor: { text: 'Cyp6g1' },
        dy: -70,
        text: 'Cyp6g1 — diversity valley of the resistance sweep',
        maxWidth: 360,
      },
    ],
  },
]
