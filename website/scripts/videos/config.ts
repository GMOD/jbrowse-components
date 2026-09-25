// The tours over the configuration tutorials, where the subject is a setting
// rather than a dataset.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { settingsVideoFixtures } from '../specs/ui.ts'
import { trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { defaultsSession, trackId } = settingsVideoFixtures

export const configVideos: VideoSpec[] = [
  // Two menu picks, then the share dialog's readable session. The height is
  // the page's third setting and the fixture pins it (see
  // settingsVideoFixtures).
  {
    name: 'config/settings_to_json',
    description:
      'Two settings clicked onto a volvox CRAM and the session they are named in: Color by... and Read connections, then Share and the readable session panel under its link',
    url: defaultsSession,
    // Sized to what overhangs the app, which the run's content report cannot
    // see and so asks for 404px back: the Read connections cascade's shadow
    // reaches 846px, and the share dialog with the session panel is 717px.
    viewportHeight: 860,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    steps: [
      // The camera parks the pointer at the top middle of the frame, which on a
      // full-width LGV is the overview ruler, and the view writes whatever is
      // under it into its own title bar. Take the pointer off it first.
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The before, held: gray reads, one per row.
      { type: 'delay', ms: 1500 },
      {
        type: 'click',
        selector: trackMenu(trackId),
        say: 'Two settings off one open menu',
        hold: 1200,
      },
      // Colour goes first: `setLinkedReads` nudges a colorBy still at `normal`
      // to `insertSizeAndOrientation`, so taking pairs first would film a click
      // on a radio the app had already filled in.
      {
        type: 'click',
        text: 'Color by...',
        say: 'Color the reads by insert size and orientation',
        hold: 1000,
      },
      { type: 'waitForText', text: 'Paired end' },
      { type: 'click', text: 'Paired end', hold: 1000 },
      { type: 'waitForText', text: 'Insert size and orientation' },
      { type: 'click', text: 'Insert size and orientation' },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 700 },
      {
        type: 'click',
        text: 'Read connections',
        say: 'Link each read to its mate',
        hold: 1000,
      },
      {
        type: 'waitForText',
        text: 'View as pairs / link supplementary alignments',
      },
      {
        type: 'click',
        text: 'View as pairs / link supplementary alignments',
      },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 700 },
      { type: 'press', key: 'Escape' },
      { type: 'press', key: 'Escape' },
      {
        type: 'waitForText',
        text: 'View as pairs / link supplementary alignments',
        hidden: true,
      },
      { type: 'waitForText', text: 'About track', hidden: true },
      { type: 'click', selector: '[aria-label="JBrowse"]' },
      { type: 'waitForText', text: 'Track settings', hidden: true },
      // The page's figure is a still of this frame, so the hold stays short.
      { type: 'delay', ms: 1200 },
      {
        type: 'click',
        selector: '[data-testid="share-button"]',
        say: 'Hand the session back with the settings readable',
        hold: 800,
      },
      { type: 'waitForText', text: 'Copy the URL below' },
      // The dialog opens on Short URL, which uploads the session and comes back
      // with an opaque `share-<id>`. Off camera for the round trip; the link it
      // produces is on camera, because a reader who could read their settings
      // out of THAT would not need the rest of the tour.
      {
        type: 'waitForText',
        text: 'Generating',
        hidden: true,
        timeout: 120000,
        cut: true,
      },
      { type: 'delay', ms: 900 },
      {
        type: 'click',
        text: 'Show readable JSON',
        say: 'The session behind that link, readable',
        hold: 800,
      },
      // The end of the route: a readable session under the `share-<id>` link.
      //
      // The tour does NOT scroll it, and three takes went into deciding that.
      // The keys are ~25 wrapped lines from the end of an ~80-line document in
      // a 20-row panel, and the panel's only lever is a caret — PageDown from
      // wherever the click landed, which moved fifteen lines between two takes,
      // or PageDown to the end, which is deterministic and stops one screen
      // past them. Neither is worth having: reading text off a moving film is
      // what a fence on the page is for, and this clip is for the route that
      // produces the text. `check-video-specs` pairs the two.
      { type: 'waitForText', text: 'Session JSON' },
      { type: 'delay', ms: 3500 },
    ],
    tailMs: 3000,
  },
]
