// The wording of the breakend context-menu row, in its own React-free module so
// the website's screenshot spec can read it under node (same reason as
// LaunchBreakendPanel/labels.ts, and the same rule: a menu label is a published
// API for the specs, so grep the specs before renaming one). It matches the
// alignments display's item and the dialog's own title, since all three open
// the same dialog.
export const SPLIT_VIEW_MENU_LABEL = 'Open breakpoint split view'
