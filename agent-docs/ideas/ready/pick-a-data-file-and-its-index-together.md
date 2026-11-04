---
name: pick-a-data-file-and-its-index-together
description: "The Add Track form makes a user pick a BAM and then its .bai in a second file selector whenever the index cannot be found by name: a browser-local file, a Google Drive or Dropbox pick, any URL behind an internet account. Every picker we use can select several files at once; pairing them with BulkAddTracksWorkflow's pairLocations fills both selectors from one pick."
---

# Pick a data file and its index together

Colin (2026-11-04), after the Google Picker landed: picking the index
separately "is in fact a general problem of our picker".

## Where the second pick is forced today

The single-track form (`AddTrackWidget/components/TrackSourceSelect.tsx`) has
two `FileSelector`s, main file and index. The model's autorun calls core's
`detectIndexLocation` (`packages/core/src/util/indexCandidates.ts`) to fill the
index in, but it can only probe a location whose neighbors have a name to ask
for:

- **a URI or a desktop local path**: probed, and the form says "Found … next
  to the main file". This case is solved.
- **a browser-local file** (Blob or FileHandle): a browser cannot see the
  file's siblings, so nothing is probed.
- **a Google Drive or Dropbox pick**: the index has its own file id, and under
  `drive.file` it is unreadable until the user picks it too.
- **any location behind an internet account**: skipped by `wouldPromptForAuth`,
  so the probe never opens a login.

In all three, the user picks the data file, then finds the index selector and
picks again.

## Every picker can already return several files

- local, web: `showOpenFilePicker({ multiple: true })`, or `<input multiple>`
  where File System Access is missing (`LocalFileChooser.tsx`)
- local, desktop: Electron's `dialog.showOpenDialog` with `multiSelections`
  (`products/jbrowse-desktop/electron/ipc/fileHandlers.ts`)
- Google Picker: `enableFeature(Feature.MULTISELECT_ENABLED)`, which hands back
  `docs[]` (`plugins/authentication/src/GoogleDriveOAuthModel/picker.ts`
  resolves only `docs[0]` today)
- Dropbox Chooser: `multiselect: true` (`DropboxOAuthModel/chooser.ts` passes
  `false`)

## And the pairing already exists

`BulkAddTracksWorkflow/pairLocations.ts` splits a batch into
`{ file, index? }` pairs by name, `foo.bam` with `foo.bam.bai` or `foo.bai`,
across every location kind, with orphan indexes reported. The single-track form
can reuse it unchanged; a Drive pick's location already ends in the file's name
(`https://drive.google.com/file/d/<id>/<name>`), so it pairs like any other.

## The change

- A picker that can return several files resolves to a list. For internet
  accounts that is `chooseLocation` becoming `chooseLocations` on
  `InternetAccountModel`; for local files, `LocalFileChooser` asks for
  `multiple`.
- `FileSelector` grows an optional `setLocations(locs)`. The main-file selector
  in `TrackSourceSelect` passes one that runs `pairLocations`, sets the data file
  as `trackData` and its index through `setDetectedIndex`, so the form's existing
  "Found …" note and the rule that a typed index wins both apply.
- A `FileSelector` with no `setLocations` keeps single selection, so the index
  selector and every other caller are untouched.

## Defaults for the calls inside it

- **Two data files in one pick** on the single-track form: take the first pair
  and say the rest belong in "Add multiple tracks at once", which links to the
  bulk workflow. Don't add several tracks from a form titled for one.
- **An index with no data file** (only a `.bai` picked): set nothing and say so,
  the `orphanIndexes` case.
- **Desktop's Electron dialog** returns paths, which the probe already pairs by
  name, so it stays single-select.
