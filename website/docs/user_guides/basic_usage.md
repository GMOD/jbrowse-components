---
title: Basic usage
description: Navigation, searching, opening files, and common UI controls
guide_category: General usage
---

**TL;DR:** navigate with the location search box (a gene name or
`chr:start-end`) plus drag-to-pan and scroll-to-zoom. Add your own data through
the open-track form, or preconfigure it in `config.json`. The controls below are
shared by JBrowse Web and Desktop.

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
view directly, without holding `Ctrl`/`Cmd`. It zooms wherever the pointer is
over the tracks; to scroll the page while it is on, put the pointer on the view
header above the tracks, or use the scrollbar. `Shift`+wheel stays horizontal
scrolling, which is what every browser does with it.

<Figure caption="The scroll-to-zoom toggle in the LGV header. With it on, the wheel zooms wherever it is over the tracks, and the header the toggle sits in still scrolls the page." src="/img/scroll_zoom_toggle.png" />

### Reordering tracks

Click and drag up or down on the drag handle on the track labels (indicated by
six vertical dots) to reorder tracks.

<Figure caption="The main linear genome view controls, labeled in place: the track selector, the scroll-zoom toggle, the pan and zoom buttons, the search box, and each track's drag handle and track menu." src="/img/lgv_usage_guide.png" />

### Reordering views

Views have no drag handle: reorder them from the view menu (hamburger icon) with
"Move up"/"Move down".

### Using the location search box

The location search box at the top of the LGV accepts several search formats:

- Region and location, e.g. `chr1:1..100` or `chr1:1-100` or `chr1 1 100`
- Coordinates abbreviated with a unit suffix, e.g. `chr1:34M-35M` or
  `chr1:1.5Mb-2Mb` or `chr1 500kb 600kb`. These are expanded to whole base pairs
  on navigation, so the search box reads back `chr1:34,000,000..35,000,000`
- Assembly, region, and location, e.g. `{hg19}chr1:1-100`
- Discontinuous regions (space-delimited, opened side-by-side), e.g.
  `chr1:1..100 chr2:1..100`
- Any of the above with `[rev]` appended to horizontally flip the region, e.g.
  `chr1:1-100[rev]`
- Gene name or feature keyword (if a text index is configured), e.g. `BRCA1`

Name searching requires a text index. See the
[text searching configuration guide](/docs/config_guides/text_searching) for
setup.

<Figure caption="When configured, you can search for gene names or other features via the location search box." src="/img/searching_lgv.png" />

When you pick a gene or feature from the search results (rather than a plain
region), JBrowse navigates to it and highlights the matched feature, pinning it
toward the top of its track. The highlight follows the feature as you pan and
zoom. Search again to move it, or click the "Clear search highlight" button in
the header bar to remove it.

<Figure caption="Selecting a feature from the search results pins it to the top of its track and boxes and tints that specific feature, not just the surrounding region." src="/img/search_feature_highlight.png" />

An instance with several annotation tracks indexed will match the same gene in
each of them. Those hits describe one place, so JBrowse navigates straight
there, through a track you already have open where there is one. The picker
appears when the hits point at different places.

## Opening tracks

To open a new track or connection, use the menu bar: `File` → `Open track...`

To load an entire track hub (UCSC track hub or JBrowse 1 data directory) at
once, use `File` → `Open connection...`. See the
[Connections guide](/docs/user_guides/connections) for details.

<Figure caption="The 'Open track...' item in the File menu opens the 'Add a track' form as a drawer widget." src="/img/add_track_form.png" />

A circular plus (+) icon button in the "Available tracks" widget also opens the
"Add a track" form.

<Figure caption="(1) The 'Available tracks' widget, opened from the button on the far left of the linear genome view. (2) The plus (+) button at its bottom right launches the 'Add a track' form." src="/img/add_track_tracklist.png" />

In the "Add a track" form, you can provide a URL or open a file from your local
machine. Which formats need an index:

- **BAM** - BAI or CSI
- **CRAM** - CRAI
- **Tabix-indexed VCF/GFF/BED** - TBI or CSI
- **BigWig/BigBed** - no index

For remote files, the index is inferred automatically when the filename follows
standard conventions (e.g. `file.bam` → `file.bam.bai`), but must be supplied
manually for local files or non-standard names.

<Video src="/media/ui/open_track_url.mp4" caption="A bigwig opened by URL against the volvox test data: the File menu item, the URL typed into the form, the name and adapter the form fills in from it, and the track drawing under the gene lane." />

### Opening local files

The **File** toggle in the "Add a track" form opens a file from your own machine
instead of a URL, and the bytes are read in the browser rather than uploaded
anywhere.

Where the browser has the File System Access API (Chrome and Edge), JBrowse Web
remembers which file you picked, so a session you reopen later can get the track
back. The browser still makes you re-grant read permission after a reload, which
is what the "local files need permission to be restored" banner and its
**Restore access** button do. Where it does not (Firefox), a local file lasts
only for the life of the tab, and after a refresh the track shows "(need to
reload)".

A local file never travels in a share link on any browser, and its index has to
be picked by hand. [JBrowse Desktop](/docs/quickstart_desktop) has neither
limit, since it stores the path.

### Adding many tracks at once

**Add multiple tracks at once** in the "Add a track" form takes a list of file
URLs, one per line, or a set of local files dropped on it. It types each row
from its extension and pairs an index (`.bai`, `.csi`, `.tbi`, `.crai`) with its
own data file, so the order they are pasted in does not matter. The preview
table under the box is where a row is renamed or removed; one assembly serves
the whole batch.

<Video src="/media/ui/bulk_add_tracks.mp4" caption="Four volvox URLs pasted in one box, scrambled, with an index sitting between two unrelated data files. The table that comes back has a row per data file, the index paired onto the one whose name it extends, and a submit button counting what it kept." />

## File format support

Core JBrowse 2 reads BAM/CRAM, tabix-indexed VCF/GFF3/GTF/BED, BigWig/BigBed,
BedGraph, BEDPE, `.hic`, MAF/BigMaf/TAF, PLINK LD, and the whole-genome
alignment formats (PAF, MUMmer `.delta`, UCSC `.chain`, MCScan `.anchors`,
MashMap, BLAST tabular), on assemblies stored as indexed FASTA, bgzip-indexed
FASTA, or 2bit. The [supported file types](/docs/config_guides/file_types) table
is the full list, with the adapter and track type each format maps to, and it is
generated from the adapters themselves.

Additional data formats can be supported via plugins; check out the
[plugin store](/docs/user_guides/plugin_store).

If you are an administrator, you can add tracks with the
[command line](/docs/quickstart_web/#adding-tracks) (CLI) or with the
[admin server](/docs/quickstart_adminserver) (GUI).

## Undo and redo

You can undo any action via Tools → Undo/Redo, or with the keyboard shortcuts
`ctrl+z`/`cmd+z` (undo) and `ctrl+shift+z`/`ctrl+y`/`cmd+shift+z` (redo).

Undo is app-wide rather than per-view, so it reaches things like reopening a
view you just closed, and it works anywhere in JBrowse Web and JBrowse Desktop.
The [embedded components](/docs/embedded_components) do not include it.

## Sharing sessions

On JBrowse Web, the "Share" button in the main menu bar generates a URL you can
send to other users.

The address-bar URL does not capture full session state, so always use the Share
button to get a shareable link.

JBrowse Desktop has no Share button, since its sessions are files you can send
directly. It can open a link someone shares with you, though, via `File` →
`Session` → `Open JBrowse Web link...`.

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

<Figure caption="Opening the track menu, from the track selector and from the track label, with a VCF track menu open." src="/img/track_menu.png" />

## Favorite and recently used tracks

You can mark favorite tracks from the Track menu and view them using the star
icon in the top right corner of the Available tracks widget.

<Figure caption="Add a track to your list of favorite tracks from the Track menu, then view them in the top right menu." src="/img/favorite_tracks.png" />

Recently opened tracks are automatically added to the recently used list,
viewable via the clock icon in the Available tracks widget.

<Figure caption="Selected tracks will be added to a recently used list, then they can be viewed using the top right menu." src="/img/recent_tracks.png" />

## Feature details

Clicking a feature opens its details panel in the drawer. The Attributes section
lists the fields as they came out of the file, so a GFF3 attribute, a BED extra
column, or a VCF INFO key appears under its own name.

Two things happen to the values on the way in, with no configuration:

- **A value that is just a URL becomes a link**, opening in a new tab. So a GFF3
  attribute like `url=https://www.uniprot.org/uniprotkb/P12345` is clickable as
  it stands.
- **HTML is rendered rather than escaped**, after being run through a sanitizer.
  Text that only looks like a tag is left alone, which is why a VCF `<TRA>`
  allele still reads as `<TRA>`.

To add fields, rename them, or hide the ones a file carries that your users
don't need, see
[customizing feature details](/docs/config_guides/customizing_feature_details).
Gene and transcript features also have a sequence panel, covered in
[](/docs/user_guides/feature_sequence).

## About track dialog

The track menu provides access to the "About track" dialog.

<Figure caption="The 'About track' dialog for a CRAM file, showing the full CRAM header and the config info." src="/img/about_track.png"/>

Opened on a **reference sequence track** — from the track selector, or from its
label when it is open — the dialog also has an "Assembly" section: the
assembly's own config (its name, its aliases, and the alias, cytoband and
genetic-code files it loads), a "Copy assembly config" button, and "Show ref
name aliases", which lists every reference name in the assembly next to the
other names it answers to. That listing has a filter box, so it is also how you
look up what one contig is called elsewhere.

## Editing track configs

Edit any track's settings directly from the track menu's **Track actions →
Settings** item. For non-admin users, edits are saved as a "session track"
override that shadows the original, so they persist with (and are shareable via)
your session without modifying the underlying admin-owned track. Admin users
editing in admin mode change the track config in place.

<Figure caption="Opening Settings from the track menu's Track actions submenu to edit any track's configuration directly." src="/img/edit_track_settings.png" />

The configuration editor has a filter box to search options by name, and tucks
rarely-needed settings (performance thresholds, adapter internals, and the like)
behind a **Show advanced settings** toggle. If a track has more than one display
type, only the currently-active display's settings are expanded; the others
collapse out of the way. Use **Reset track settings** in the track menu to clear
your edits and revert to the underlying config.

### Pinning a setting as your default

Many track-menu settings (color-by scheme, read and feature height,
soft-clipping, and more) carry a small **pin** next to them. Clicking the pin
makes that value the default for every track of the same type, and clicking it
again clears the default. Every open track a default affects is badged in the
track selector. See
[defaults for all tracks](/docs/user_guides/display_defaults) for the whole
system: what follows a default, what keeps its own value, and where the defaults
are kept.

The [display settings tutorial](/docs/tutorials/display_settings) covers the
same settings from the other direction: as persistent defaults in `config.json`,
and as overrides carried in a URL or an embedded session.

## Rubberband selection

Click and drag on either the main (lower) or overview (upper) scale bar to
rubberband-select a region.

<Figure caption="Rubberbanding the main and overview scalebars. The main one produces extra options on selection." src="/img/rubberband.png" />

The main scale bar's menu holds **Zoom to region**, **Get sequence**, **Copy
range**, **Highlight region** and **Bookmark region**, plus a **Launch** submenu
of what the loaded plugins can start from the selection:

- [](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at),
  when a synteny dataset in the session covers this assembly. It opens one panel
  per assembly aligning to the selection, whether or not the synteny track is
  turned on. Pick the dataset in its dialog.
- [](/docs/user_guides/consensus_sequence), when an alignments track is open.
  Pick the track from the submenu.

Both name the track they run on, because that choice decides the result.

Every entry here has a track-menu twin that takes the visible window instead of
a selection, so none of them needs a drag to be found: **Get sequence (visible
region)** on the reference sequence track, **Consensus sequence (visible
region)** on an alignments track, and the synteny launch's own
[visible-region entry](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at).

## Scalebar chromosome name menu

The chromosome (reference sequence) names drawn along the scale bar are
clickable. Clicking a name opens a menu with:

- Focus on `<name>` - navigate to that entire region
- Actions submenu:
  - Reverse region - reverse-complement just that region, in place
  - Horizontally flip view - reverse-complement the whole view (the same as the
    header-bar flip described below)
  - Move left / Move right and Move to far left / Move to far right - reorder
    the region relative to the others when multiple regions are displayed (the
    "far" options appear only when they would land somewhere different from a
    single-step move)
  - Remove this region from view

## View and layout controls

Four layout controls, reached from the view's hamburger menu or the header bar.

### Show ideogram

When the assembly is configured with
[cytobands](/docs/config_guides/assemblies#configuring-cytoband-ideograms), the
overview bar draws the chromosome as a banded ideogram with the centromere
marked. **Show ideogram** toggles it; it is on by default, and the choice is
remembered for later sessions.

The entry is absent unless the view is showing a whole chromosome, since a
sub-region gives an arbitrary slice of bands and draws the centromere as a lone
half triangle.

### Track label positioning

Track labels can be positioned on their own row, overlapping the data to save
vertical space, or hidden entirely, from the three choices under the **Track
labels** heading in **Show...** in the view's hamburger menu.

<Figure caption="The overlap and offset track label positioning options." src="/img/tracklabels.png" />

### Horizontally flip

The view can be horizontally flipped (reverse complemented), reversing the
coordinate direction, from **Horizontally flip** in the view's hamburger menu.
Triangles in the overview bar indicate the current orientation.

<Figure caption="Before and after horizontally flipping." src="/img/horizontally_flip.png" links="Normal orientation=horizontally_flip_before,Flipped=horizontally_flip_after" />

### Drawer widget position

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

- [](/docs/user_guides/connections)
- [](/docs/user_guides/bookmark_widget)
- [](/docs/user_guides/plugin_store)
- [Track selector configuration](/docs/config_guides/track_selector)
- [](/docs/config_guides/avoiding_stale_config)
- [](/docs/config_guides/file_types)
