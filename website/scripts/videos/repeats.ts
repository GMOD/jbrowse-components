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
  // The painting partitions on `repClass` whenever the file has that column
  // (PREFERRED_PARTITION_FIELDS), so one Display types pick is the whole
  // route. A Partition by... beat was filmed here too and cut: it picked the
  // radio the app had already filled.
  {
    name: 'repeats/painting_display_switch',
    description:
      "UCSC RepeatMasker from one packed lane to a labelled lane per repeat class: Display types, and the multi-row painting partitioning on the file's own repClass column",
    goal: 'Split one RepeatMasker lane into a lane per repeat class',
    url: twoDisplaySession,
    // The lanes are the tall state, at the 260 the session pins them to — the
    // same height multirow/display_types_rows captures its lanes at. The packed
    // lane the tour opens on is a third of that, so the blank under it is the
    // lanes' room. Even, per the encode.
    viewportHeight: 592,
    readySelector: '::-p-text(RepeatMasker)',
    readyTimeout: 60000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: 'Every repeat in one packed lane, whatever its class',
      },
      {
        type: 'click',
        selector: trackMenu(rmskTrackId),
        say: 'Redraw the lane as a painting from the track menu',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Display types' },
      { type: 'click', text: 'Display types', hold: 1200 },
      { type: 'waitForText', text: 'Multi-row feature display (painting)' },
      { type: 'click', text: 'Multi-row feature display (painting)' },
      // The switch re-fetches through the multi-row RPC, which packs the
      // features into rows on the way back.
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      // The menu icon keeps FOCUS once the cascade closes, so its "Track
      // settings" tooltip stays up over the first lane; a click on the logo
      // blurs it.
      { type: 'click', selector: '[aria-label="JBrowse"]' },
      { type: 'waitForText', text: 'Track settings', hidden: true },
      {
        type: 'delay',
        ms: 4000,
        say: 'A labelled lane per class, LINE to SINE, found in the file itself',
      },
    ],
    tailMs: 4500,
  },
]
