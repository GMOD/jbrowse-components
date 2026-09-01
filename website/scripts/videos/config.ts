// The tours over the configuration tutorials, where the subject is a setting
// rather than a dataset.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { settingsVideoFixtures } from '../specs/ui.ts'
import { trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { defaultsSession, trackId } = settingsVideoFixtures

// The share dialog's mode picker. It is a CascadingMenuButton behind a settings
// gear rather than a control on the dialog's face, which is the half of the
// route display_settings.md's "Ask JBrowse what you just set" cannot say
// and a still cannot show being taken. The label comes off the tooltip MUI
// hands the icon button.
const SHARE_MODE_MENU = '[aria-label="Session sharing settings"]'

export const configVideos: VideoSpec[] = [
  // The page's own TL;DR, performed: "every setting in a track menu has a name,
  // and JBrowse will tell you what it is." Three menu picks, then the route
  // that hands the session back in a form the names are readable in — a claim
  // about a ROUND TRIP, and so the one thing display_settings.md's single
  // figure cannot make. That figure is the end of this route flattened into one
  // still: the before state — default gray, one read per row, no clipped ends —
  // appears nowhere on the page.
  //
  // The second half is the stronger one and the page has no picture of it at
  // all. The share dialog CHANGES SHAPE as it is used: Plaintext JSON is a
  // radio inside the gear's cascade, picking it refires the fetch, and only
  // then does a "Show readable JSON" checkbox exist to tick — and only then a
  // "Session JSON" field to read. The page's "click Share, choose Plaintext
  // JSON, and tick Show readable JSON" reads as three controls on one dialog
  // face, and two of the three are not there when the dialog opens.
  //
  // The FOURTH setting is missing on purpose. Track height is a ResizeHandle
  // drag and that component publishes no selector, so the drag would be two
  // measured viewport coordinates; the fixture pins the height instead and the
  // page keeps the drag in prose. See the fixture bag for the whole reason.
  //
  // Filming it corrected the page's fence too, which is the second defect.
  // Every one of these settings is a `setConf` on the display's configuration
  // (`setShowSoftClipping`, `setColorScheme`, `setLinkedReads` in
  // LinearAlignmentsDisplay/model.ts), so the session records them in its
  // trackId-keyed `trackConfigDeltas` map rather than on the view's copy of the
  // track — where the fence used to print them, in a shape the dialog does not
  // produce. The panel this tour opens is where that was read off.
  {
    name: 'config/settings_to_json',
    description:
      "Three settings clicked onto a volvox CRAM and the session they are named in: Color by..., Read connections and Show..., then Share, the dialog's settings icon, Plaintext JSON, and the readable session panel that mode brings with it",
    url: defaultsSession,
    // Sized to the two things that OVERHANG the app, which the run's content
    // report cannot see: it measures 456px here and asks for 444px back. The
    // `Show...` submenu is ten checkboxes and reaches 808px, and the share
    // dialog with the session panel open is 717px tall and centred, so a frame
    // cut to the app clips the menu and then the payoff. Even, per the encode.
    viewportHeight: 860,
    // The pileup has to be carrying reads before the camera starts: the first
    // three steps change how it is drawn, and a tour of an empty lane changing
    // colour is a tour of nothing.
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    settleMs: 10000,
    steps: [
      // The camera parks the pointer at the top middle of the frame, which on a
      // full-width LGV is the overview ruler, and the view writes whatever is
      // under it into its own title bar. Take the pointer off it first.
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The before, held: gray reads, one per row, clipped ends trimmed off.
      { type: 'delay', ms: 1500 },
      {
        type: 'click',
        selector: trackMenu(trackId),
        say: 'Three settings off one open menu',
        hold: 1200,
      },
      // Three picks off ONE open menu. Each row here is a checkbox or a radio,
      // which writes its setting and leaves the cascade standing, so the tour
      // walks from submenu to submenu rather than reopening the track menu
      // three times — and the pileup redraws behind the menu each time.
      //
      // Colour goes FIRST, which is the third thing filming this corrected and
      // the page's bullet order now follows. `setLinkedReads` nudges a colorBy
      // still at `normal` to `insertSizeAndOrientation` as it enters chain
      // mode, so taking pairs first left the tour opening a menu to pick a
      // radio the app had already filled in — the reader watching would see
      // nothing happen and no still would ever show it.
      {
        type: 'click',
        text: 'Color by...',
        say: 'Color the reads by insert size and orientation',
        hold: 1000,
      },
      // `Paired end` is a level the page did not have. The pairing schemes are
      // a group of their own under Color by... (`group: 'pairedEnd'` in
      // shared/colorSchemes.ts), so a reader following "Color by... → Insert
      // size and orientation" lands on a list of six basic schemes with no such
      // row in it. The first take of this tour is what found that.
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
      {
        type: 'click',
        text: 'Show...',
        say: 'Put the soft-clipped bases back on',
        hold: 1000,
      },
      { type: 'waitForText', text: 'Show soft clipping' },
      { type: 'click', text: 'Show soft clipping' },
      // Soft clipping invalidates every fetched region rather than restyling
      // what is drawn, so this one is a re-read of the CRAM rather than a
      // relayout of what is loaded, and it is six seconds of a pileup holding
      // still. The other two settings stay on camera because the reads move.
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      // Two levels of cascade to leave, and focus is still in the list, so
      // Escape reaches it. The waits are what say it happened.
      { type: 'press', key: 'Escape' },
      { type: 'press', key: 'Escape' },
      { type: 'waitForText', text: 'Show soft clipping', hidden: true },
      { type: 'waitForText', text: 'About track', hidden: true },
      // The menu icon keeps focus once the menu goes, so its "Track settings"
      // tooltip outlives it over the first reads. The logo is a bare <g> with
      // no handler: the click blurs the icon and parks the cursor clear.
      { type: 'click', selector: '[aria-label="JBrowse"]' },
      { type: 'waitForText', text: 'Track settings', hidden: true },
      // The state the page's figure is of. Held briefly rather than long: the
      // page prints a still of exactly this frame twenty lines above the clip.
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
        selector: SHARE_MODE_MENU,
        say: 'The share dialog grows a control as it is used',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Plaintext JSON' },
      { type: 'click', text: 'Plaintext JSON' },
      // A radio writes its setting and leaves the menu standing, here as
      // everywhere else, and this one stands over the control it just brought
      // into existence. Escape reaches it while focus is in the list; the
      // dialog behind it keeps its own Escape handler unfired, because the menu
      // consumes the key.
      { type: 'press', key: 'Escape' },
      { type: 'waitForText', text: 'Plaintext JSON', hidden: true },
      // The dialog is a control taller than it was a second ago.
      { type: 'waitForText', text: 'Show readable JSON' },
      { type: 'delay', ms: 900 },
      { type: 'click', text: 'Show readable JSON' },
      // The end of the route: a readable session where a `share-<id>` was.
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
