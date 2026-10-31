---
name: tooltip-quieting
description: "Tooltips were too large and opened too eagerly for expert users (Colin, 2026-10-31: the 'Zoom on scroll' tooltip is large and fires on mouseover). Done: a short scroll-zoom tip, and a 600 ms enterDelay on every MUI Tooltip in the theme. Open: the track selector's description tooltip ignores that delay, tooltips stay open while hovered, and six remaining tooltips run over 60 characters."
---

# Quieter tooltips

The ask: show less text in tooltips and stop them opening on every pass-by.
Making them dismissable was considered and set aside. A tooltip already closes
when the pointer leaves, and a "don't show again" option would need saved
per-user state for little gain once tooltips are short and slow to open.

## Done

- `SCROLL_ZOOM_TIP` in `packages/core/src/ui/scrollZoomLabels.ts` is the
  header toggle's tooltip, one clause long. `SCROLL_ZOOM_HELP` (the
  ctrl+scroll and "the header still scrolls" caveats) now appears only as the
  Preferences dialog's help text (`ViewPreferencesTab.tsx`).
- `MuiTooltip.defaultProps.enterDelay: 600` in `packages/core/src/ui/theme.ts`.
  MUI's own hysteresis still opens the next tooltip immediately once one has
  been shown, so scanning a toolbar stays fast.
- `pnpm verify`'s reds were only in the untracked
  `website/scripts/tmp-probe-tcga.ts`, not this change. The jest suites for
  ScrollZoomToggle, CascadingMenuButton, PreferencesDialog, the LGV Header, the
  track selector and the marks tooltips pass. `jbrowse-web` was not run
  locally; a global tooltip delay can move a hover-then-find test there.
- `names.generated.ts` does not yet list `SCROLL_ZOOM_TIP`. Pre-push autogen
  regenerates it.

## Next, in order

- **Track selector descriptions open instantly.**
  `plugins/data-management/src/HierarchicalTrackSelectorWidget/components/tree/SharedTooltip.tsx`
  renders a controlled `<Tooltip open>`, so the theme's `enterDelay` never
  applies. Every row the pointer crosses pops its `data-tooltip` description
  (`TrackLabel.tsx:136`), which can be a paragraph of HTML. Wait about 600 ms
  after the pointer settles on a row before setting state, and clear on
  mouseout as now. The tests at `HierarchicalTrackSelector.test.tsx` around
  "entering a row without a description hides the tooltip" will need a timer
  advance. This tooltip must stay interactive, because descriptions carry
  links.
- **Tooltips close when the pointer leaves the control.** MUI tooltips are
  interactive by default: hovering the tooltip keeps it open, which is why a
  large one lingers over the track the user was heading for. Set
  `disableInteractive: true` in the theme's `MuiTooltip.defaultProps`, and pass
  `disableInteractive={false}` only where the tooltip holds a link.
- **Trim the long ones.** No other tooltip text is anywhere near the old
  scroll-zoom one (about 210 characters). These are the ones over 60:
  - `plugins/linear-comparative-view/src/LaunchSyntenyView/PanelList.tsx:166`
    (123): could be "Reference panel — can't be removed".
  - `plugins/circular-view/src/CircularView/components/ImportForm/index.tsx:267`
    (82).
  - `packages/app-core/src/AppWidgets/PluginStoreWidget/components/InstalledPlugin.tsx:129-130`
    (76, 64): these explain what a click does, which a clearer button label
    could do instead.
  - `plugins/config/src/ConfigurationEditorWidget/components/SlotEditor.tsx:226-227`
    (68 each): same shape.
  - `plugins/data-management/src/HierarchicalTrackSelectorWidget/components/dialogs/ManageConnectionsDialog.tsx:20`
    (60).

  The survey only matched string literals inside `<Tooltip title=…>`. A title
  passed through a constant or a JSX node was not measured, so grep for
  `title={` on Tooltips before calling the list complete.
- **A rule to keep it there:** a tooltip on a labelled control adds one short
  clause or is left out, and longer explanations go in Preferences or the
  docs. Put it as one sentence where a reader would add a tooltip (beside
  `SCROLL_ZOOM_TIP` is the obvious site), not in CLAUDE.md, since nothing
  enforces it.

Declined: a global "hide tooltips" preference. With the delay and
close-on-leave, tooltips rarely get in the way, and a setting adds state for
little gain.
