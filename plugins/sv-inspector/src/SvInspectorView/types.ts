import type { SpreadsheetViewCommands } from '@jbrowse/plugin-spreadsheet-view'

/**
 * The launch keys `SvInspectorView` writes code for: the same four the
 * spreadsheet half takes, forwarded verbatim, so this extends that view's
 * commands rather than restating them — a field added there arrives here too,
 * where a lookalike interface would still typecheck while silently dropping it.
 *
 * The two child views are declared properties, so a saved session's
 * `spreadsheetView`/`circularView` stay state and never reach the blob.
 *
 * #launchKeys SvInspectorView — the URL parameters page renders this interface,
 * and the one it extends, as the view's launch-key table.
 */
export interface SvInspectorViewCommands extends SpreadsheetViewCommands {}
