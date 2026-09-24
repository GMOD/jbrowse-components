import type { SpreadsheetViewCommands } from '@jbrowse/plugin-spreadsheet-view'

/**
 * #launchKeys SvInspectorView
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
  // trackIds every view a row or chord opens starts with, beside the callset's
  // own track: the tumor and normal alignments, a coverage track, an assembly's
  // synteny track
  drilldownTracks?: string[]
}
