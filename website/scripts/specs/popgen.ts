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

// The In(2L)t inversion extent as a single annotation feature (published dm6
// breakpoints 2L:2,225,744–13,154,180), so the reader can see the elevated-Fst
// plateau lines up with the inverted region. An inline FromConfigAdapter rather
// than a hosted BED — one feature needs no file.
const IN2LT_INVERSION_TRACK = {
  type: 'FeatureTrack',
  trackId: 'in2lt_inversion',
  name: 'In(2L)t inversion',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'FromConfigAdapter',
    adapterId: 'in2lt',
    features: [
      {
        uniqueId: 'in2lt',
        refName: 'chr2L',
        start: 2225744,
        end: 13154180,
        name: 'In(2L)t',
        type: 'inversion',
      },
    ],
  },
}

export const popgenSpecs: ScreenshotSpec[] = [
  // Genome-wide (all six dm6 arms): the In(2L)t Fst track rises into a tall
  // elevated block across the whole left arm of chromosome 2 — the
  // recombination-suppression footprint of the inversion — while every other arm
  // (2R, 3L, 3R, 4, X) sits at low background Fst. Plotting the whole genome (not
  // just 2L in isolation) is what makes the elevation read AS elevated: the
  // reader sees the 2L signal is genuinely anomalous, not a baseline the eye has
  // nothing to compare against (reviewer). The In(2L)t inversion-extent track
  // marks the 2L segment; whole-panel π below stays near-uniform across arms, the
  // expected contrast to the localized Fst spike.
  {
    mode: 'url',
    name: 'popgen/fst_in2lt_2L',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [IN2LT_INVERSION_TRACK, FST_TRACK, PI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          // all six major arms in order, so 2L's elevated Fst reads against the
          // rest of the genome as background
          displayedRegionNames: [
            'chr2L',
            'chr2R',
            'chr3L',
            'chr3R',
            'chr4',
            'chrX',
          ],
          tracks: [
            // inversion extent on top so the Fst block below reads against it
            {
              trackId: 'in2lt_inversion',
              displaySnapshot: { type: 'LinearBasicDisplay', height: 40 },
            },
            {
              trackId: 'fst_in2lt',
              displaySnapshot: { type: 'LinearWiggleDisplay', height: 200 },
            },
            {
              trackId: 'pi_all',
              displaySnapshot: { type: 'LinearWiggleDisplay', height: 150 },
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: '[data-testid="wiggle-display-done"]',
    readyText: 'π (whole panel)',
    readyTimeout: 90000,
    // inversion(40) + fst(200) + pi(150) + headers clear the crop
    viewportHeight: 620,
    settleMs: 14000,
  },

  // Zoomed out to a ~3 Mb window on 2R centered on Cyp6g1 (12,185,667–12,188,431)
  // so the diversity valley reads as a sharp, localized dip against the arm-wide
  // background rather than filling the frame. Whole-panel pi collapses across
  // ~12.13–12.20 Mb (the gene's window drops to ~0.0004, under 10% of the 2R
  // average ~0.0049) between high-diversity flanks — the classic hard-sweep
  // signature of the DDT/neonicotinoid-resistance haplotype fixing in this
  // derived population. A genomic highlight band marks Cyp6g1, which is a sliver
  // at this zoom; the gene track underneath is a showOnlyGenes context strip.
  {
    mode: 'url',
    name: 'popgen/pi_cyp6g1',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [PI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          loc: 'chr2R:10,700,000-13,700,000',
          // stable band over the Cyp6g1 gene body so it stays identifiable even
          // though the gene is only a few pixels wide at this scale (replaces a
          // text-anchored box that landed in blank space once labels stopped
          // rendering at the wider zoom)
          highlight: [
            {
              refName: 'chr2R',
              start: 12_185_000,
              end: 12_189_000,
              assemblyName: 'dm6',
              label: 'Cyp6g1',
            },
          ],
          tracks: [
            {
              trackId: 'pi_all',
              displaySnapshot: { type: 'LinearWiggleDisplay', height: 240 },
            },
            {
              trackId: 'dm6-ncbiRefSeqCurated',
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                height: 110,
                showOnlyGenes: true,
              },
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: '[data-testid="wiggle-display-done"]',
    // the wiggle track name always renders; the old gene-label wait no longer
    // works at this zoom (labels collapse)
    readyText: 'whole panel',
    readyTimeout: 90000,
    viewportHeight: 560,
    settleMs: 12000,
    annotations: [
      {
        type: 'text',
        x: 760,
        y: 66,
        maxWidth: 360,
        fontSize: 15,
        text: 'π collapses to under a tenth of the arm-wide background here — the hard-sweep signature at the Cyp6g1 insecticide-resistance gene',
      },
    ],
  },
]
