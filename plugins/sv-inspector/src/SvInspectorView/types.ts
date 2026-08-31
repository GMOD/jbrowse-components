import type { SpreadsheetViewCommands } from '@jbrowse/plugin-spreadsheet-view'

/**
 * The launch keys `SvInspectorView` writes code for: the same four the
 * spreadsheet half takes, forwarded verbatim, so this extends that view's
 * commands rather than restating them — a field added there arrives here too,
 * where a lookalike interface would still typecheck while silently dropping it.
 * The two below are redeclared only because they mean more here than they do
 * over there, and the spec table shows the description beside the name.
 *
 * The two child views are declared properties, so a saved session's
 * `spreadsheetView`/`circularView` stay state and never reach the blob.
 *
 * #launchKeys SvInspectorView — the URL parameters page renders this interface,
 * and the one it extends, as the view's launch-key table.
 */
export interface SvInspectorViewCommands extends SpreadsheetViewCommands {
  // the assembly both halves are read against. With only this and no `uri`, the
  // view opens on its import form with that assembly already selected rather
  // than the first one in the config
  assembly?: string
  // search-box text for the spreadsheet half, applied once the file is loaded.
  // The circular half draws the rows it leaves, so this is what makes a chord
  // subset reachable from a link
  filterText?: string
}
