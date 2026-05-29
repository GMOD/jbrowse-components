- regenerate embedded examples
- circular/sv filterings
Now I have the full picture. Key insight from sv-inspector: the circular view's features are already filtered by the spreadsheet's visibleRows — so this filter adds extra chord-level control on top. The
  popover pattern from SyntenySettingsPopover (TuneIcon button → inline Popover) is the right UI here since filter controls should be immediately accessible, not buried in a track menu.

  Plan:
  - Add minSize + hiddenTypes to display model; filteredFeatures getter
  - ChordFilterControls.tsx — a TuneIcon popover in the circular view controls with a size field + type checkboxes
  - Wire into Controls.tsx when a chord display is present

- hic testing
- reversed region testing

