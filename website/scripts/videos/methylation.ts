// The allele-specific methylation tour.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { methylationVideoFixtures } from '../specs/methylation.ts'
import { cascade, leaveMenu, openTrackByUrlSteps, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { ungrouped, readsTrackId, bamUrl, readsAbsent } =
  methylationVideoFixtures

// An opened track's id is its name slugged plus a timestamp (makeTrackId), and
// its name is the file's.
const OPENED_READS_MENU =
  '[data-testid="track_menu_icon"][data-trackid^="hg002_snrpn_5mc_haplotagged.bam-"]'
const TWO_COLOR = cascade(
  'menuitem',
  'One color per type, plus low-probability & unmodified in blue',
)

export const methylationVideos: VideoSpec[] = [
  // The page's modBAM opened by URL and colored the way its next sentence says,
  // for a reader holding their own file rather than the fence's config.
  {
    name: 'methylation/open_modbam',
    description:
      'The haplotagged modBAM opened by URL and painted with its 5mC calls: File, Open track..., the URL pasted in, then Color by..., Modifications and its two-color mode from the new track menu',
    goal: 'Open a modBAM by URL and paint its reads by methylation',
    url: readsAbsent,
    viewportHeight: 740,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      ...openTrackByUrlSteps(bamUrl, {
        open: 'From File, Open track, then paste the BAM URL',
        add: 'The form infers the .bai index and the adapter; Add',
      }),
      {
        type: 'click',
        selector: OPENED_READS_MENU,
        say: 'Then color the reads by their modification calls',
        hold: 1200,
      },
      { type: 'waitForSelector', selector: cascade('submenu', 'Color by...') },
      {
        type: 'click',
        selector: cascade('submenu', 'Color by...'),
        hold: 1000,
      },
      {
        type: 'waitForSelector',
        selector: cascade('submenu', 'Modifications'),
      },
      {
        type: 'click',
        selector: cascade('submenu', 'Modifications'),
        hold: 1200,
      },
      { type: 'waitForSelector', selector: TWO_COLOR },
      { type: 'click', selector: TWO_COLOR, hold: 1200 },
      ...leaveMenu(TWO_COLOR),
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'delay',
        ms: 3500,
        say: 'Each read painted by its 5mC calls: red methylated, blue not',
      },
    ],
    tailMs: 3000,
  },
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
    goal: "Split SNRPN's reads by haplotype to see one copy methylated",
    url: ungrouped,
    // The grouped pileup stacks into three sections inside the track's own 320,
    // so the app's height does not move across the tour. 740 rather than the
    // figures' 730: those are captured at the content height and this is a fixed
    // frame, and the app measures 734 here, so 730 clips its lower edge.
    viewportHeight: 740,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: "Both haplotypes' reads interleave; red is a methylated CpG, blue is not",
      },
      {
        type: 'click',
        selector: trackMenu(readsTrackId),
        say: 'Group the reads by their HP haplotype tag',
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
      {
        type: 'delay',
        ms: 3500,
        say: 'HP 1 is methylated at the SNRPN promoter; HP 2 is not',
      },
    ],
    tailMs: 4000,
  },
]
