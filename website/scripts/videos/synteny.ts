// The three-strain H. pylori stack.
import { syntenyVideoFixtures } from '../specs/synteny.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { emptySyntenyForm, strains } = syntenyVideoFixtures

// The form's assembly dropdowns carry no test id, but each is labelled, so the
// accessible name is the handle -- the same string the page's own numbered steps
// use when they say to pick an assembly per row.
const assemblyRow = (n: number) =>
  `::-p-aria([name="Row ${n} assembly"][role="combobox"])`
const option = (assembly: string) => `li[role="option"]::-p-text(${assembly})`

// One button per adjacent pair, whose aria-label says which pair it is rather
// than leaving a tour counting anonymous icons.
const connector = (top: number) =>
  `button[aria-label="Configure synteny track between row ${top} and ${top + 1}"]`

export const syntenyVideos: VideoSpec[] = [
  // WHERE GETTING THE DATA IN IS THE DIFFICULTY, which is the case that makes
  // the route the tour rather than a figure. The page's three-strain figure is
  // preceded by four numbered steps -- Manual, an assembly per row, Add row for
  // the third, the arrow between each adjacent pair, Launch -- and the figure is
  // the state after all four. Nothing on the page performs any of them, and a
  // form is what prose is worst at: every step names a shape on screen that the
  // reader has not seen yet.
  //
  // It also answers the question the numbered list raises and does not settle:
  // what the arrow is FOR when only one alignment exists between a given pair.
  // Opening each connector shows the form had already resolved it, so the
  // control is there for the case where the pairing is ambiguous.
  {
    name: 'synteny/three_strain_import',
    description:
      'Building the three-strain H. pylori stack from the import form: Manual, one genome per row, Add row for the third, each connector resolving its own alignment, and Launch',
    url: emptySyntenyForm,
    // One frame serves both states, and the run reports the app at 301 on the
    // opening form and 572 once the stack is standing, so this is the taller of
    // the two with a little margin.
    viewportHeight: 600,
    readySelector: '::-p-text(Quick start)',
    readyTimeout: 120000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 2000 },
      // Quick start is the default because the config ships synteny tracks, and
      // it launches ONE pair. Manual is where a third row is reachable at all.
      { type: 'click', text: 'Manual', say: 'Manual', hold: 1800 },
      {
        type: 'waitForText',
        text: 'Select assemblies for linear synteny view',
      },
      // Manual inherits Quick start's pairing, which is j99 over 26695 -- the
      // config's first synteny track, not the stack this page builds. So every
      // row gets set rather than the tour pretending the form opens ready, and
      // row 2 goes first: setting row 1 to 26695 while row 2 still holds it
      // would ask the form to pair an assembly with itself.
      { type: 'click', selector: assemblyRow(2), say: 'Row 2', hold: 900 },
      { type: 'click', selector: option(strains.middle), hold: 1400 },
      { type: 'click', selector: assemblyRow(1), say: 'Row 1', hold: 900 },
      { type: 'click', selector: option(strains.top), hold: 1400 },
      { type: 'click', text: 'Add row', say: 'Add row', hold: 1600 },
      // The new row's dropdown sits directly under the connector arrow Add row
      // put above it, and the cursor reaches it across that arrow, which raises
      // the arrow's tooltip over the dropdown -- so the click lands on the
      // tooltip. Escape dismisses it; nothing else is open to take the key.
      { type: 'press', key: 'Escape' },
      { type: 'delay', ms: 600 },
      { type: 'click', selector: assemblyRow(3), say: 'Row 3', hold: 900 },
      { type: 'click', selector: option(strains.bottom), hold: 1600 },
      // The two connectors, opened rather than set: each pair has exactly one
      // alignment here and the form has already chosen it, so what these clicks
      // show is the choice being right, which is what a reader working through
      // the numbered steps otherwise has no way to check.
      {
        type: 'click',
        selector: connector(1),
        say: '26695 against CHC155',
        hold: 2600,
      },
      {
        type: 'click',
        selector: connector(2),
        say: 'CHC155 against J99',
        hold: 2600,
      },
      { type: 'click', text: 'Launch', say: 'Launch' },
      // Three genomes and two alignment indexes, off camera: a film of that is a
      // film of an empty view.
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'delay', ms: 3500 },
    ],
    tailMs: 4000,
  },
]
