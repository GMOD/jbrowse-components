/**
 * The launch keys `SpreadsheetView` takes, none of them a declared property.
 *
 * #launchKeys SpreadsheetView — the URL parameters page shows each field's
 * `//` comment, and the docs build fails on a field without one.
 */
export interface SpreadsheetViewCommands {
  // the assembly the sheet's rows are read against. With only this and no
  // `uri`, the view opens on its import form with that assembly already
  // selected rather than the first one in the config
  assembly?: string
  // the file to load into the sheet. A spec view is untyped user input, so this
  // can be absent, and the view then opens on the import form
  uri?: string
  // what a relative `uri` resolves against. A config loaded from a URL gets
  // this beside every `uri` in it, a `defaultSession` view's included, so the
  // sheet's file resolves against the config the way a track's does
  baseUri?: string
  // the file's format. Otherwise detected from the extension, falling back to
  // VCF, so name it for a file the extension does not identify
  fileType?: string
  // search-box text, applied once the file is loaded
  filterText?: string
  // the rearrangement event to open the sheet narrowed to: a value of the
  // file's `INFO.EVENT`, matched whole
  svEventFilter?: string
}
