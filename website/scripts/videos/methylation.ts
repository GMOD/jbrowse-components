// The allele-specific methylation tour.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { methylationVideoFixtures } from '../specs/methylation.ts'
import { trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { ungrouped, readsTrackId } = methylationVideoFixtures

export const methylationVideos: VideoSpec[] = [
  // A RE-LAYOUT, and the one on this page that a pair of stills states least
  // well. hg002_snrpn_group_by_hp stacks the ungrouped reads over the grouped
  // ones and its caption has to carry the whole claim in a sentence -- "Only the
  // grouping differs" -- because that is precisely what two pictures of a
  // pileup cannot show. Which read in the top half is which read in the bottom
  // is the question, and reads have no identity a reader can track across two
  // frames; watching them move answers it and a caption only asserts it.
  //
  // The dialog is the other half, and no still on the page has it at all. The
  // section says to "enter HP", and what the app does with that is worth
  // seeing: it scans the reads in view and reports back which values it found,
  // so the two bands are named by the data rather than by the tutorial.
  {
    name: 'methylation/group_by_hp',
    description:
      'Splitting the SNRPN pileup by haplotype: the track menu, the tag dialog scanning the reads for HP, and the interleaved mix resolving into one methylated band and one unmethylated',
    url: ungrouped,
    // The grouped pileup stacks into three sections inside the track's own 320,
    // so the app's height does not move across the tour. 740 rather than the
    // figures' 730: those are captured at the content height and this is a fixed
    // frame, and the app measures 734 here, so 730 clips its lower edge.
    viewportHeight: 740,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    settleMs: 15000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The before, held: an interleaved mix of methylated and unmethylated
      // reads, which is the state the page says "does not show the answer".
      { type: 'delay', ms: 3000 },
      {
        type: 'click',
        selector: trackMenu(readsTrackId),
        say: 'Group the pileup by the HP tag',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Group by...' },
      { type: 'click', text: 'Group by...', hold: 1200 },
      { type: 'waitForText', text: 'Tag...' },
      { type: 'click', text: 'Tag...' },
      { type: 'waitForText', text: 'Group by tag' },
      { type: 'delay', ms: 1200 },
      {
        type: 'type',
        selector: '[data-testid="group-tag-name-input"]',
        value: 'HP',
        say: 'HP',
      },
      // The dialog's own answer, and the beat this tour exists to hold: the scan
      // runs over the reads in view and names the values it found, so a reader
      // sees the two bands coming from the data rather than from the tutorial.
      {
        type: 'waitForText',
        text: 'Found values',
        timeout: 120000,
        hold: 2500,
      },
      // THE STEP THE PAGE DID NOT KNOW IT NEEDED. This box arrives CHECKED here:
      // its default is "unless you are already coloring by this tag", so any
      // non-tag scheme -- modifications included -- counts as free to replace,
      // and submitting as-is paints HP1 one flat color and HP2 another. That is
      // the opposite of what this section is about, which is what each haplotype
      // is METHYLATED like. The page said "leave coloring on modifications" as
      // though that were the default; leaving it is this click.
      {
        type: 'click',
        text: 'Also color reads by this tag',
        say: 'Keep the modification coloring',
        hold: 1800,
      },
      { type: 'click', text: 'Submit' },
      // Grouping REFETCHES rather than re-laying-out what is loaded -- the frame
      // says "Downloading alignments.." -- so this is off camera for the reason
      // every slow step here is. `displayPainted` alone would not hold it: the
      // lane was painted a moment ago in its ungrouped state and satisfies the
      // gate before the new one arrives.
      {
        type: 'waitForText',
        text: 'HP: none',
        timeout: 120000,
        cut: true,
      },
      { type: 'waitForAppSettled' },
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 4000,
  },
]
