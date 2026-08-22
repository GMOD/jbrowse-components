// The tour over the repeat tutorials, where the subject is a display that
// discovers its own rows from the file.
import { repeatVideoFixtures } from '../specs/ui.ts'
import { trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { rmskTrackId, twoDisplaySession } = repeatVideoFixtures

export const repeatVideos: VideoSpec[] = [
  // A RE-LAYOUT, and the page's own claim about it is the one thing two
  // pictures cannot make: cookbook_color_by_type_two_ways stacks the packed
  // lane over the lanes and its caption asserts "the same track and the same
  // fetch". Nothing in either half shows that no file was prepared and no
  // second track added, which is the whole of what repeatmasker_classes.md is
  // for.
  //
  // It also films a step the page does not have. Picking the display type
  // leaves `partitionField` at its `name` default, which on RepeatMasker is one
  // row per repeat — the intermediate state here — and the class lanes are a
  // second pick, `Partition by...`. The page goes straight from the Display
  // types instruction to a figure of the finished lanes, so a reader following
  // it lands on the hairlines and has nothing to do next. The user guide
  // (multirow_feature_track.md) has both picks; the tutorial had one.
  //
  // The `Partition by...` submenu is the payoff frame: its options are read off
  // the loaded features' own attribute names, so `repClass` and `repFamily`
  // being in that list IS the TL;DR's "the class is already in the file".
  {
    name: 'repeats/painting_display_switch',
    description:
      "UCSC RepeatMasker from one packed lane to a labelled lane per repeat class: Display types, the multi-row painting, then Partition by repClass out of the columns the file's own features carry",
    url: twoDisplaySession,
    // The lanes are the tall state, at the 260 the session pins them to — the
    // same height multirow/display_types_rows captures its lanes at. The packed
    // lane the tour opens on is a third of that, so the blank under it is the
    // lanes' room. Even, per the encode.
    viewportHeight: 520,
    readySelector: '::-p-text(RepeatMasker)',
    readyTimeout: 60000,
    settleMs: 6000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The packed lane, held: every class in one row, which is the state the
      // page's top panel is of.
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector: trackMenu(rmskTrackId),
        say: 'Track menu',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Display types' },
      {
        type: 'click',
        text: 'Display types',
        say: 'Display types',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Multi-row feature display (painting)' },
      {
        type: 'click',
        text: 'Multi-row feature display (painting)',
        say: 'Multi-row feature display (painting)',
      },
      // The switch re-fetches through the multi-row RPC, which packs the
      // features into rows on the way back.
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      // One row per repeat NAME, which is what the display type alone gives.
      // Held, because the next pick is what a reader is here for.
      { type: 'delay', ms: 3000 },
      {
        type: 'click',
        selector: trackMenu(rmskTrackId),
        say: 'Track menu',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Partition by...' },
      {
        type: 'click',
        text: 'Partition by...',
        say: 'Partition by...',
        // long enough to read the list, which is the file's own columns rather
        // than anything the config named
        hold: 3000,
      },
      { type: 'waitForText', text: 'repClass' },
      { type: 'click', text: 'repClass', say: 'repClass' },
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      // A radio that only writes a setting keeps its menu up, and the menu
      // covers the lanes it just produced. Two levels to leave, and the waits
      // are what say it happened: focus is inside the list after the click, so
      // Escape reaches it here.
      { type: 'press', key: 'Escape' },
      { type: 'press', key: 'Escape' },
      { type: 'waitForText', text: 'Partition by...', hidden: true },
      { type: 'waitForText', text: 'About track', hidden: true },
      // The menu icon keeps FOCUS once the menu goes, so its "Track settings"
      // tooltip stays up over the first lane; hovering elsewhere does not take
      // a focus tooltip down. A click on the logo blurs it and parks the cursor
      // clear of the lanes — the logo is a bare `<g>` with no handler, so the
      // click does nothing else.
      { type: 'click', selector: '[aria-label="JBrowse"]' },
      { type: 'waitForText', text: 'Track settings', hidden: true },
      // A labelled lane per class, discovered from the window.
      { type: 'delay', ms: 4000 },
    ],
    tailMs: 4500,
  },
]
