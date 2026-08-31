/**
 * The launch keys `SpreadsheetView` writes code for. Not one of them is a
 * declared property of the view — the file and the assembly it is read against
 * are the import wizard's, and `filterText` belongs to the sheet the load
 * builds — so the partition lifts all four unconditionally.
 *
 * #launchKeys SpreadsheetView — the URL parameters page renders this interface
 * as the view's launch-key table. The `//` comment above each field is what
 * that table shows, so a field added without one fails the docs build rather
 * than rendering a blank cell.
 */
export interface SpreadsheetViewCommands {
  // the assembly the sheet's rows are read against. With only this and no
  // `uri`, the view opens on its import form with that assembly already
  // selected rather than the first one in the config
  assembly?: string
  // the file to load into the sheet. A spec view is untyped user input, so this
  // can be absent, and the view then opens on the import form
  uri?: string
  // the file's format. Otherwise detected from the extension, falling back to
  // VCF, so name it for a file the extension does not identify
  fileType?: string
  // search-box text, applied once the file is loaded
  filterText?: string
}
