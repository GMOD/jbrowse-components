---
title: Basic usage
description: Navigation, searching, opening files, and common UI controls
guide_category: General usage
---

Navigate with the location search box (a gene name or `chr:start-end`) plus
drag-to-pan and scroll-to-zoom. Add your own data through the open-track form,
or preconfigure it in `config.json`. JBrowse Web and Desktop share the controls
below.

## Linear genome view

Open a linear genome view (LGV) from the menu bar: **Add → Linear genome view**

### Scrolling

The view scrolls on the mouse wheel, on a click-and-drag, and from the pan
buttons in the LGV header.

### Zooming

Zoom with the buttons and slider in the LGV header, or with:

- `Ctrl` + mousewheel (on Mac, trackpad pinch-to-zoom also works)
- `Shift` + click-and-drag for a rubberband selection
- `Shift` alone shows a red vertical guide bar

Keyboard shortcuts, with the view focused:

- `Ctrl`/`Cmd` + `↑`: zoom in
- `Ctrl`/`Cmd` + `↓`: zoom out
- `Ctrl`/`Cmd` + `←` / `→`: pan left/right

The **Zoom on scroll** checkbox in the LGV header makes the bare mouse wheel
zoom wherever the pointer is over the tracks. To scroll the page while it is on,
put the pointer on the view header or use the scrollbar. `Shift`+wheel stays
horizontal scrolling.

<Figure caption="The Zoom on scroll checkbox in the LGV header." src="/img/scroll_zoom_toggle.png" />

### Reordering tracks

Drag the six-dot handle on a track label up or down.

<Figure caption="The main linear genome view controls, labeled in place: the track selector, the scroll-zoom toggle, the pan and zoom buttons, the search box, and each track's drag handle and track menu." src="/img/lgv_usage_guide.png" />

### Resizing tracks

- **One track:** drag the thin handle under it. Double-clicking the handle grows
  a track that scrolls its content to show all of it.
- **Every track at once:** drag the grey bar under the last track. Each track
  gives or takes in proportion to its height, so tall tracks move the most.
  While the view is taller than the window, the bar stays at the bottom of the
  window.
- **Fit to the window:** double-click that bar, or pick **Fit tracks to window**
  in the view's hamburger menu, to size the tracks so the view fills the window.

### Reordering views

To reorder views, use "Move up"/"Move down" in the view menu (hamburger icon).

### Using the location search box

The search box at the top of the LGV accepts:

- a region, e.g. `chr1:1..100` or `chr1:1-100` or `chr1 1 100`
- unit suffixes, e.g. `chr1:34M-35M` or `chr1:1.5Mb-2Mb` or `chr1 500kb 600kb`,
  expanded to whole base pairs on navigation
- an assembly prefix, e.g. `{hg19}chr1:1-100`
- several regions, space-delimited and opened side by side, e.g.
  `chr1:1..100 chr2:1..100`
- `[rev]` appended to flip the region, e.g. `chr1:1-100[rev]`
- a gene name or feature keyword, e.g. `BRCA1`, when a text index is configured

Name searching needs a text index; see
[text searching](/docs/config_guides/text_searching).

<Figure caption="Searching for a gene name in the location box." src="/img/searching_lgv.png" />

Picking a gene or feature from the results navigates to it and highlights it,
pinned toward the top of its track. The highlight follows the feature as you pan
and zoom. Search again to move it, or click the "Clear feature highlights"
button in the header bar.

<Figure caption="A feature picked from the search results, pinned to the top of its track and boxed." src="/img/search_feature_highlight.png" />

When several indexed annotation tracks match the same gene at one place, JBrowse
navigates straight there, through an open track where there is one. The picker
appears only when the hits point at different places.

## Opening tracks

Open a track from **File → Open track...** in the menu bar. For a whole track
hub (UCSC track hub or JBrowse 1 data directory), use **File → Open
connection...**; see [](/docs/user_guides/connections).

<Figure caption="File → Open track... opens the Add a track form as a drawer widget." src="/img/add_track_form.png" />

The circular plus (+) button in the "Available tracks" widget opens the same
form.

<Figure caption="(1) The Available tracks widget. (2) Its plus button opens the Add a track form." src="/img/add_track_tracklist.png" />

The form takes a URL or a local file. The index each format needs:

- **BAM** - BAI or CSI
- **CRAM** - CRAI
- **Tabix-indexed VCF/GFF/BED** - TBI or CSI
- **BigWig/BigBed** - no index

For remote files the index is inferred from conventional names (`file.bam` →
`file.bam.bai`). Local files and non-standard names need it supplied by hand.

<Video src="/media/ui/open_track_url.mp4" caption="A bigwig opened by URL: the File menu item, the URL typed into the form, and the track drawing." />

### Opening local files

The **File** toggle in the "Add a track" form opens a file from your own
machine. The browser reads the bytes and uploads nothing.

- **Chrome and Edge:** JBrowse Web remembers which file you picked, so a
  reopened session can get the track back. After a reload, the "local files need
  permission to be restored" banner's **Restore access** button re-grants read
  permission.
- **Firefox:** a local file lasts for the life of the tab, and after a refresh
  the track shows "(need to reload)".
- **Share links** leave out local files, and you pick a local file's index by
  hand.
- **[JBrowse Desktop](/docs/quickstart_desktop)** stores the path, so it has
  none of these limits.

### Adding many tracks at once

**Add multiple tracks at once** in the "Add a track" form takes file URLs, one
per line, or a set of local files dropped on it.

- **Types:** each row is typed from its extension.
- **Indexes:** an index (`.bai`, `.csi`, `.tbi`, `.crai`) is paired with the
  data file it indexes, in any order.
- **Preview table:** rename or remove a row here.
- **Assembly:** one assembly serves the batch.
- **Drop on the session:** files dropped anywhere on an open session open this
  form with them already added, aimed at the view they were dropped on. Genome
  files open the add-genome form instead.

<Video src="/media/ui/bulk_add_tracks.mp4" caption="Four URLs pasted in one box, and the table pairing each index with its data file." />

## File format support

Core JBrowse 2 reads BAM/CRAM, tabix-indexed VCF/GFF3/GTF/BED, BigWig/BigBed,
BedGraph, BEDPE, `.hic`, MAF/BigMaf/TAF, PLINK LD, and the whole-genome
alignment formats (PAF, MUMmer `.delta`, UCSC `.chain`, MCScan `.anchors`,
MashMap, BLAST tabular), on assemblies stored as indexed FASTA, bgzip-indexed
FASTA, or 2bit. The [supported file types](/docs/config_guides/file_types) table
is the full list, generated from the adapters themselves.

Plugins add further formats; see the
[plugin store](/docs/user_guides/plugin_store).

Administrators can add tracks with the
[command line](/docs/quickstart_web/#adding-tracks) or the
[admin server](/docs/quickstart_adminserver).

## Undo and redo

Use **Tools → Undo** and **Tools → Redo**, or `ctrl+z`/`cmd+z` (undo) and
`ctrl+shift+z`/`ctrl+y`/`cmd+shift+z` (redo).

Undo is app-wide, so it reaches things like reopening a view you just closed.
The [embedded components](/docs/embedded_components) have no undo.

## Sharing sessions

On JBrowse Web, the "Share" button in the main menu bar generates a URL to send
to other users. The address-bar URL does not capture full session state, so
always use the Share button.

JBrowse Desktop has no Share button, since its sessions are files. It opens a
shared link via **File → Session → Open JBrowse Web link...**.

On JBrowse Web, a session file from **File → Export session** dropped onto the
app opens as a copy, after the open session is saved.

<Figure caption="The session share dialog." src="/img/share_button.png" />

The session URL contains:

- the open views and their settings (e.g. track label positioning)
- the tracks in each view, including any you added yourself
- per-track display state, such as an alignments track's soft-clipping and sort
  settings

A shared link can therefore contain custom tracks the recipient opens directly,
with no admin needed to publish them first.

## Track menu

The track menu (vertical "..." on the track selector or track label) holds the
track-specific functions. Some options need the track open (from the track
label); basics like "About track" are always available from the track selector.

<Figure caption="Opening the track menu from the track selector and from the track label." src="/img/track_menu.png" />

**Display types**, on a track that has more than one display, switches how the
track draws its data. Each track type's guide describes its displays.

## Filtering tracks

The filter box at the top of Available tracks keeps the tracks that contain
every word you type, in any order, in the name, category, description or a
metadata value, plus the table's other columns. `thp1` also finds "THP-1". A
tree row kept for a word it does not show names where the word was in grey after
the track name, such as "biosample: K562", or shows the part of its description
that holds the word. The box shows how many tracks are kept, of how many, such
as "6 of 800".

- **`"quoted words"`** must appear together, as typed.
- **`-word`** drops the tracks that contain it: `liftover -mm10`. A minus before
  a plain number is part of it: `-2.3` finds that negative value.

Under the filter box, a chip for each of the first few fields that group tracks
(and "More filters" for the rest) lists that field's values with their track
counts. Check values to keep only the tracks with one of them, in the tree and
the table alike. An active chip names what it keeps, and its × clears it. The
tree's category headings already sort tracks by category, so its category chip
shows only in the table.

While a search or chip narrows the table, the checkbox in its header turns on
every track that matched, or turns them all off again. To gather tracks into a
selection instead, for example to combine them into a multi-row track,
`Ctrl`/`Cmd`+click their names, or choose "Add matching tracks to selection"
from the ☰ menu.

## Favorite and recently used tracks

Mark favorites from the Track menu. In Available tracks, the three small buttons
at the right of the filter chips pick all tracks, your favorites (the star) or
the tracks you opened recently (the clock), in the tree or the table. The ☰
menu at the left of the filter box clears either list.

<Figure caption="Adding a track to the favorites from its track menu, and the favorites list." src="/img/favorite_tracks.png" />

<Figure caption="The recently used tracks list." src="/img/recent_tracks.png" />

## Feature details

Clicking a feature opens its details panel in the drawer. The Attributes section
lists the fields as they came out of the file: a GFF3 attribute, a BED extra
column, or a VCF INFO key appears under its name in the file.

JBrowse changes two kinds of value as it loads them, with no configuration:

- **A value that is just a URL becomes a link**, so a GFF3 attribute like
  `url=https://www.uniprot.org/uniprotkb/P12345` is clickable
- **HTML renders after JBrowse passes it through a sanitizer.** Text that only
  looks like a tag stays as typed, so a VCF `<TRA>` allele still reads as
  `<TRA>`

A table in the panel, such as a VCF's samples, has a search box that reads words
as [the track filter box](#filtering-tracks) does, `"quoted words"` and `-word`
included.

To add, rename or hide fields, see
[customizing feature details](/docs/config_guides/customizing_feature_details).
Gene and transcript features also have a sequence panel, covered in
[](/docs/user_guides/feature_sequence).

## About track dialog

The track menu opens this dialog.

<Figure caption="The About track dialog for a CRAM file." src="/img/about_track.png"/>

On a **reference sequence track** the dialog also has an "Assembly" section: the
assembly's config (name, aliases, and the alias, cytoband and genetic-code files
it loads), a "Copy assembly config" button, and "Show ref name aliases", which
lists every reference name next to its aliases. That listing has a filter box
for looking up what one contig is called elsewhere.

## Editing track configs

**Track actions → Settings** in the track menu edits any track's settings. The
session stores each edit as an override of the track's config:

- **In the session:** edits persist, share and undo with the session, and the
  config file everyone else is served stays as it was.
- **Into the config:** an admin writes them into that file with **Admin → Save
  track settings to config**.

<Figure caption="Track actions → Settings in the track menu." src="/img/edit_track_settings.png" />

The form shows the track's name, description, category and data files, and the
settings of the display this view draws. What the display draws (color,
grouping, filters) is under the track menu's **Advanced → Edit plot...**.

- **Reset button:** returns a field to the track's config.
- **Edit as JSON...** edits every setting as `config.json` writes it. A key the
  track does not take is refused under the text.
- **Reset track settings** in the track menu reverts to the underlying config.

The [display settings tutorial](/docs/tutorials/display_settings) covers the
same settings as persistent defaults in `config.json`, and as overrides in a URL
or an embedded session.

## Rubberband selection

Click and drag on either the main (lower) or overview (upper) scale bar.

<Figure caption="Rubberband selections on the main and overview scalebars." src="/img/rubberband.png" />

The main scale bar's menu holds **Zoom to region**, **Get sequence...**, **Copy
range**, **Highlight region** ([](/docs/user_guides/highlights)), then a
**Launch** submenu of what can open from the selection:

- **Linear genome view:** a new view of the span with this view's tracks and
  their settings, which scrolls and zooms independently
- [](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at):
  when a synteny dataset in the session covers this assembly, one panel per
  assembly aligning to the selection, whether or not the synteny track is turned
  on
- [](/docs/user_guides/consensus_sequence): when an alignments track is open

**Get sequence...**, the consensus sequence and the synteny launch also have a
track-menu entry that takes the visible window instead of a selection: **Get
sequence (visible region)...** on the reference sequence track, **Consensus
sequence (visible region)...** on an alignments track, and the synteny launch's
[visible-region entry](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at).

Clicking the scale bar without dragging names a single base. Its menu holds
**Center view here**, **Zoom to base level** and **Copy coordinate**.

The [synteny](/docs/user_guides/linear_synteny_view) and
[breakpoint split](/docs/user_guides/sv_visualization#breakpoint-split-view)
views have one scale bar for the whole stack. A drag there leads with **Zoom to
region(s)**, which zooms every row at once; below it, one entry per genome opens
the selection menu for that genome.

## Scalebar chromosome name menu

The chromosome names along the scale bar are clickable. The menu holds:

- Focus on `<name>` - navigate to that entire region
- Actions submenu:
  - Reverse region - reverse-complement just that region, in place
  - Horizontally flip view - reverse-complement the whole view
  - Move left / Move right and Move to far left / Move to far right - reorder
    the region relative to the others when several are displayed
  - Remove this region from view

## View and layout controls

The controls below sit in the view's hamburger menu and the header bar.

### Ideogram

When the assembly has
[cytobands](/docs/config_guides/assemblies#configuring-cytoband-ideograms), the
overview bar draws the chromosome as a banded ideogram with the centromere
marked. **Show → Show ideogram** toggles it, on by default and remembered for
later sessions.

The entry appears only when the view shows a whole chromosome, since a
sub-region gives an arbitrary slice of bands.

### Track label positioning

Track labels sit on a separate row, overlap the data, or hide entirely, from the
**Track labels** submenu in the view's hamburger menu.

<Figure caption="The overlap and offset track label positioning options." src="/img/tracklabels.png" />

### Horizontally flip

**Horizontally flip** in the view's hamburger menu reverse-complements the view.
Triangles in the overview bar show the current orientation.

<Figure caption="Before and after horizontally flipping." src="/img/horizontally_flip.png" links="Normal orientation=horizontally_flip_before,Flipped=horizontally_flip_after" />

### Drawer widget position

The header bar dropdown moves the drawer widget, which starts on the right, to
the left or right side.

<Figure caption="Toggling the drawer widget to the left side of the screen." src="/img/drawer_widget_toggle.png" />

## Track table

The tree and table buttons at the right of the filter box in "Available tracks"
switch to a filterable table of all tracks. The rows follow the tree's order,
with each track's category in the column beside its name, until you click a
column header to sort; a search lists the tracks whose name matches first. The
filter chips stay set when you switch between the tree and the table. In table
mode, the track selector's ☰ menu shows or hides any column through Manage
columns, and the expand button beside the tree and table buttons slides the
table out over the genome view with a column for each field most tracks have;
the same button slides it back. Tracks with `metadata` fields get extra columns:

```json
{
  "trackId": "my_track",
  "name": "My Track",
  "metadata": { "origin": "public", "date_added": "2024-02-20" }
}
```

See the [configuration guide](/docs/config_guides/track_selector).

## See also

- [](/docs/user_guides/connections)
- [](/docs/user_guides/highlights)
- [](/docs/user_guides/plugin_store)
- [Track selector configuration](/docs/config_guides/track_selector)
- [](/docs/config_guides/avoiding_stale_config)
- [](/docs/config_guides/file_types)
