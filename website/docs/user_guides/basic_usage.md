---
title: Basic usage
description: Navigation, searching, opening files, and common UI controls
guide_category: General usage
---

## Linear genome view

To open a linear genome view (LGV), use the menu bar: `Add` →
`Linear genome view`

### Scrolling

You can scroll using the mouse wheel or by clicking and dragging. The pan
buttons in the LGV header also scroll left and right.

### Zooming

Use the zoom buttons and slider in the LGV header to zoom in and out. You can
also:

- hold `Ctrl` and use the mousewheel to zoom (on Mac, trackpad pinch-to-zoom
  also works)
- hold `Shift` and click-and-drag to create a rubberband selection
- hold `Shift` without dragging to reveal a red vertical guide bar

Keyboard shortcuts (when the view is focused):

- `Ctrl`/`Cmd` + `↑`: zoom in
- `Ctrl`/`Cmd` + `↓`: zoom out
- `Ctrl`/`Cmd` + `←` / `→`: pan left/right

The scroll-to-zoom toggle button in the LGV header lets the mouse wheel zoom the
view directly, without holding `Ctrl`/`Cmd`. Hold `Shift` while scrolling to
scroll normally instead.

<Figure caption="Click the scroll-to-zoom toggle button in the LGV header (top) to enable it; once enabled, the mouse wheel zooms the view (bottom)." src="/img/scroll_zoom_toggle.png" />

### Reordering tracks

Click and drag up or down on the drag handle on the track labels (indicated by
six vertical dots) to reorder tracks.

<Figure caption="The main linear genome view controls, labeled in place: the track selector button opens the track list, the scroll-zoom toggle lets the mouse wheel zoom the view, the pan buttons scroll left/right, the zoom buttons and slider zoom the view, the search box accepts regions or feature names, and each track can be reordered by its drag handle or configured from its track menu." src="/img/lgv_usage_guide.png" />

### Reordering views

Unlike tracks, views cannot be reordered by drag-and-drop. Instead, use the view
menu (hamburger icon) and select "Move up"/"Move down".

### Using the location search box

The location search box at the top of the LGV accepts several search formats:

- Region and location, e.g. `chr1:1..100` or `chr1:1-100` or `chr1 1 100`
- Assembly, region, and location, e.g. `{hg19}chr1:1-100`
- Discontinuous regions (space-delimited, opened side-by-side), e.g.
  `chr1:1..100 chr2:1..100`
- Any of the above with `[rev]` appended to horizontally flip the region, e.g.
  `chr1:1-100[rev]`
- Gene name or feature keyword (if a text index is configured), e.g. `BRCA1`

Name searching requires a text index — see the
[text searching configuration guide](/docs/config_guides/text_searching) for
setup.

<Figure caption="When configured, you can search for gene names or other features via the location search box." src="/img/searching_lgv.png" />

When you pick a gene or feature from the search results (rather than a plain
region), JBrowse navigates to it and also highlights the specific matched
feature on its track, so it stands out from its neighbors even in a dense
region. The highlighted feature is pinned toward the top of the track so it
isn't buried in the layout, and the highlight follows the feature as you pan and
zoom. Search again to move the highlight to a new feature, or click the "Clear
search highlight" button that appears in the header bar to remove it.

<Figure caption="Selecting a feature from the search results pins it to the top of its track and boxes and tints that specific feature, not just the surrounding region." src="/img/search_feature_highlight.png" />

## Opening tracks

To open a new track or connection, use the menu bar: `File` → `Open track...`

To load an entire track hub (UCSC track hub or JBrowse 1 data directory) at
once, use `File` → `Open connection...`. See the
[Connections guide](/docs/user_guides/connections) for details.

<Figure caption="The 'Open track...' item in the File menu opens the 'Add a track' form as a drawer widget." src="/img/add_track_form.png" />

:::tip

A circular plus (+) icon button in the "Available tracks" widget also opens the
"Add a track" form.

:::

<Figure caption="(1) Open the 'Available tracks' widget with the button on the far left of the linear genome view. (2) The circular plus (+) icon button in the bottom right of the 'Available tracks' widget can also be used to launch the 'Add a track' form." src="/img/add_track_tracklist.png" />

In the "Add a track" form, you can provide a URL or open a file from your local
machine. Some formats require an index: BAM (BAI or CSI), CRAM (CRAI), and
tabix-indexed files like VCF/GFF/BED (TBI or CSI) all do; BigWig/BigBed do not.
For remote files, the index is inferred automatically when the filename follows
standard conventions (e.g. `file.bam` → `file.bam.bai`), but must be supplied
manually for local files or non-standard names.

### Adding many tracks at once

To load a batch of tracks in one step, click **Add multiple tracks** in the "Add
a track" form (or **Add a single track instead** to switch back). Paste a list
of file URLs — one per line — or drop a set of local files. JBrowse auto-detects
each track's type from its extension and pairs index files (`.bai`, `.csi`,
`.tbi`, `.crai`) with their data file automatically, so you can paste data and
index URLs together without matching them up by hand. A preview table shows the
detected type and guessed name for every row, which you can rename or remove
before submitting. Pick one assembly that applies to all the tracks in the
batch, then add them together.

## File format support

The following file formats are supported in core JBrowse 2:

### General

- CRAM
- BAM
- VCF (Tabix-indexed)
- GFF3 (Tabix-indexed)
- BED (Tabix-indexed)
- BigBed
- BigWig
- BEDPE
- JBrowse 1 nested containment lists (NCList)
- .hic (Hi-C contact matrix)

### SV inspector

- plain text VCF, BED, CSV, TSV, BEDPE, STAR-fusion output (tabular formats)

### Synteny and dotplot

- PAF (e.g. minimap2)
- .delta (MUMmer)
- .chain (UCSC chain)
- .anchors / .anchors.simple (MCScan python version)
- .out (MashMap)
- BLAST tabular output

### Sequence adapters

- Indexed FASTA
- BGZip indexed FASTA
- 2bit

Additional data formats can be supported via plugins; check out the
[plugin store](/plugin_store).

:::note

If you are an administrator, you can add tracks with the
[command line](/docs/quickstart_web/#adding-tracks) (CLI) or with the
[admin server](/docs/quickstart_adminserver) (GUI).

:::

## Undo and redo

You can undo any action via Tools → Undo/Redo, or with the keyboard shortcuts
`ctrl+z`/`cmd+z` (undo) and `ctrl+shift+z`/`ctrl+y`/`cmd+shift+z` (redo).

## Sharing sessions

On JBrowse Web, the "Share" button in the main menu bar generates a URL you can
send to other users.

The address-bar URL does not capture full session state — always use the Share
button to get a shareable link.

:::note

Sharing sessions is not available for JBrowse Desktop.

:::

<Figure caption="The session share dialog, which gives you a short URL to share your session with other users." src="/img/share_button.png" />

The session URL contains:

- the open views and their settings (e.g. track label positioning)
- the tracks in each view, including any you added yourself
- per-track display state, such as an alignments track's soft-clipping and sort
  settings

This means you can share links with custom tracks without being a JBrowse admin.

## Track menu

The track menu (vertical "..." on the track selector or track label) provides
access to track-specific functions. Some options are only available when the
track is open (from the track label); basic options like "About track" are
always available from the track selector.

<Figure caption="Screenshot showing how to open the track menu (both in the track selector area and in the track label area of the linear genome view), and an example of a VCF track with its track menu open" src="/img/track_menu.png" />

## Favorite and recently used tracks

You can mark favorite tracks from the Track menu and view them using the star
icon in the top right corner of the Available tracks widget.

<Figure caption="Add a track to your list of favorite tracks from the Track menu, then view them in the top right menu." src="/img/favorite_tracks.png" />

Recently opened tracks are automatically added to the recently used list,
viewable via the clock icon in the Available tracks widget.

<Figure caption="Selected tracks will be added to a recently used list, then they can be viewed using the top right menu." src="/img/recent_tracks.png" />

## About track dialog

The track menu provides access to the "About track" dialog.

<Figure caption="Screenshot of the 'About track' dialog for a CRAM file, showing the full CRAM file header and config info. Having the full header of a BAM/CRAM file available is helpful to easily check what genome it was aligned to, for example." src="/img/about_track.png"/>

## Editing track configs

You can edit the settings of any track directly from the track menu's **Track
actions → Settings** item — there is no longer any need to copy the track first.
For non-admin users, the edits are saved as a "session track" override that
shadows the original, so they persist with (and are shareable via) your session
without modifying the underlying admin-owned track. Admin users editing in admin
mode change the track config in place.

<Figure caption="Opening Settings from the track menu's Track actions submenu to edit any track's configuration directly." src="/img/edit_track_settings.png" />

The configuration editor has a filter box to search options by name, and tucks
rarely-needed settings (performance thresholds, adapter internals, and the like)
behind a **Show advanced settings** toggle. If a track has more than one display
type, only the currently-active display's settings are expanded; the others
collapse out of the way. Use **Reset track settings** in the track menu to clear
your edits and revert to the underlying config.

### Pinning a setting as your default

Many track-menu settings — color-by scheme, feature height mode, soft-clipping,
group-by, and more — carry a small **pin** next to them. Clicking the pin
promotes that setting as the default for every track of the same type in your
session, not just the one track. Pinned defaults ride along in the session, so
they travel with a shared session link, and every track a default affects is
badged in the track selector. Click the pin again (or **Follow default** on a
track) to un-pin and revert to the underlying configuration.

## Rubberband selection

Click and drag on either the main (lower) or overview (upper) scale bar to
rubberband-select a region.

<Figure caption="Screenshot of rubberbanding both the main and overview scalebars. The main scalebar produces extra options on selection, e.g. Zoom to region, Get sequence, etc." src="/img/rubberband.png" />

## Scalebar chromosome name menu

The chromosome (reference sequence) names drawn along the scale bar are
clickable. Clicking a name opens a menu with:

- **Focus on `<name>`** — navigate to that entire region
- **Actions** submenu:
  - **Reverse region** — reverse-complement just that region, in place
  - **Horizontally flip view** — reverse-complement the whole view (the same as
    the header-bar flip described below)
  - **Move left** / **Move right** and **Move to far left** / **Move to far
    right** — reorder the region relative to the others when multiple regions
    are displayed (the "far" options appear only when they would land somewhere
    different from a single-step move)
  - **Remove this region from view**

## Track label positioning

Track labels can be positioned on their own row or overlapping the data to save
vertical screen space. They can also be hidden. This is done by clicking on the
hamburger menu for a specific view.

<Figure caption="Example of using the overlap and offset track label positioning options." src="/img/tracklabels.png" />

## Horizontally flip

The view can be horizontally flipped (reverse complemented), reversing the
coordinate direction. Triangles in the overview bar indicate the current
orientation.

<Figure caption="Before and after horizontally flipping." src="/img/horizontally_flip.png" />

## Toggle drawer widget on left or right side of screen

The drawer widget can be toggled to the left or right side of the screen using
the header bar dropdown. It appears on the right by default.

<Figure caption="Toggling drawer widget to the left side of the screen" src="/img/drawer_widget_toggle.png" />

## Faceted track selector

The faceted track selector shows all tracks as a filterable table. Open it via
the filter icon in the top right of the "Available tracks" widget.

Tracks with `metadata` fields in their config get extra filterable columns:

```json
{
  "trackId": "my_track",
  "name": "My Track",
  "metadata": { "origin": "public", "date_added": "2024-02-20" }
}
```

See the [configuration guide](/docs/config_guides/track_selector) for more.

## See also

- [Connections](/docs/user_guides/connections) — load an entire UCSC or JBrowse
  track hub at once
- [Bookmark widget](/docs/user_guides/bookmark_widget) — save and revisit
  regions
- [Plugin store](/docs/user_guides/plugin_store) — add new track, view, and
  adapter types
- [Track selector configuration](/docs/config_guides/track_selector) — metadata
  columns and faceted filtering
- [Avoiding stale config](/docs/config_guides/avoiding_stale_config) — how admin
  edits and session-track overrides interact
- [Supported file types](/docs/config_guides/file_types) — the config-level
  companion to the format list above
