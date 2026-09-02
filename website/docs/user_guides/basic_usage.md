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

Open a linear genome view (LGV) from the menu bar: `Add` → `Linear genome view`

### Scrolling

Mouse wheel, click-and-drag, or the pan buttons in the LGV header.

### Zooming

The zoom buttons and slider in the LGV header, or:

- `Ctrl` + mousewheel (on Mac, trackpad pinch-to-zoom also works)
- `Shift` + click-and-drag for a rubberband selection
- `Shift` alone shows a red vertical guide bar

Keyboard shortcuts, with the view focused:

- `Ctrl`/`Cmd` + `↑`: zoom in
- `Ctrl`/`Cmd` + `↓`: zoom out
- `Ctrl`/`Cmd` + `←` / `→`: pan left/right

The scroll-to-zoom toggle in the LGV header makes the bare mouse wheel zoom
wherever the pointer is over the tracks. To scroll the page while it is on, put
the pointer on the view header or use the scrollbar. `Shift`+wheel stays
horizontal scrolling.

<Figure caption="The scroll-to-zoom toggle in the LGV header. With it on, the wheel zooms wherever it is over the tracks, and the header the toggle sits in still scrolls the page." src="/img/scroll_zoom_toggle.png" />

### Reordering tracks

Drag the six-dot handle on a track label up or down.

<Figure caption="The main linear genome view controls, labeled in place: the track selector, the scroll-zoom toggle, the pan and zoom buttons, the search box, and each track's drag handle and track menu." src="/img/lgv_usage_guide.png" />

### Reordering views

Views have no drag handle. Use "Move up"/"Move down" in the view menu (hamburger
icon).

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

<Figure caption="When configured, you can search for gene names or other features via the location search box." src="/img/searching_lgv.png" />

Picking a gene or feature from the results navigates to it and highlights it,
pinned toward the top of its track. The highlight follows the feature as you pan
and zoom. Search again to move it, or click "Clear search highlight" in the
header bar.

<Figure caption="Selecting a feature from the search results pins it to the top of its track and boxes and tints that specific feature, not just the surrounding region." src="/img/search_feature_highlight.png" />

When several indexed annotation tracks match the same gene at one place, JBrowse
navigates straight there, through an open track where there is one. The picker
appears only when the hits point at different places.

## Opening tracks

Menu bar: `File` → `Open track...`. For a whole track hub (UCSC track hub or
JBrowse 1 data directory), `File` → `Open connection...`; see
[](/docs/user_guides/connections).

<Figure caption="The 'Open track...' item in the File menu opens the 'Add a track' form as a drawer widget." src="/img/add_track_form.png" />

The circular plus (+) button in the "Available tracks" widget opens the same
form.

<Figure caption="(1) The 'Available tracks' widget, opened from the button on the far left of the linear genome view. (2) The plus (+) button at its bottom right launches the 'Add a track' form." src="/img/add_track_tracklist.png" />

The form takes a URL or a local file. Which formats need an index:

- **BAM** - BAI or CSI
- **CRAM** - CRAI
- **Tabix-indexed VCF/GFF/BED** - TBI or CSI
- **BigWig/BigBed** - no index

For remote files the index is inferred from conventional names (`file.bam` →
`file.bam.bai`). Local files and non-standard names need it supplied by hand.

<Video src="/media/ui/open_track_url.mp4" caption="A bigwig opened by URL against the volvox test data: the File menu item, the URL typed into the form, the name and adapter the form fills in from it, and the track drawing under the gene lane." />

### Opening local files

The **File** toggle in the "Add a track" form opens a file from your own
machine. The bytes are read in the browser, not uploaded anywhere.

Where the browser has the File System Access API (Chrome and Edge), JBrowse Web
remembers which file you picked, so a reopened session can get the track back.
The browser still asks you to re-grant read permission after a reload, which is
what the "local files need permission to be restored" banner and its **Restore
access** button do. Elsewhere (Firefox), a local file lasts for the life of the
tab, and after a refresh the track shows "(need to reload)".

A local file never travels in a share link, and its index has to be picked by
hand. [JBrowse Desktop](/docs/quickstart_desktop) has neither limit, since it
stores the path.

### Adding many tracks at once

**Add multiple tracks at once** in the "Add a track" form takes file URLs, one
per line, or a set of local files dropped on it. Each row is typed from its
extension, and an index (`.bai`, `.csi`, `.tbi`, `.crai`) is paired with its own
data file whatever the order. The preview table is where a row is renamed or
removed, and one assembly serves the batch.

<Video src="/media/ui/bulk_add_tracks.mp4" caption="Four volvox URLs pasted in one box, scrambled, with an index sitting between two unrelated data files. The table that comes back has a row per data file, the index paired onto the one whose name it extends, and a submit button counting what it kept." />

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

Tools → Undo/Redo, or `ctrl+z`/`cmd+z` (undo) and
`ctrl+shift+z`/`ctrl+y`/`cmd+shift+z` (redo).

Undo is app-wide, so it reaches things like reopening a view you just closed.
The [embedded components](/docs/embedded_components) do not include it.

## Sharing sessions

On JBrowse Web, the "Share" button in the main menu bar generates a URL to send
to other users. The address-bar URL does not capture full session state, so
always use the Share button.

JBrowse Desktop has no Share button, since its sessions are files. It opens a
shared link via `File` → `Session` → `Open JBrowse Web link...`.

<Figure caption="The session share dialog, which gives you a short URL to share your session with other users." src="/img/share_button.png" />

The session URL contains:

- the open views and their settings (e.g. track label positioning)
- the tracks in each view, including any you added yourself
- per-track display state, such as an alignments track's soft-clipping and sort
  settings

So a link can carry custom tracks without a JBrowse admin.

## Track menu

The track menu (vertical "..." on the track selector or track label) holds the
track-specific functions. Some options need the track open (from the track
label); basics like "About track" are always available from the track selector.

<Figure caption="Opening the track menu, from the track selector and from the track label, with a VCF track menu open." src="/img/track_menu.png" />

## Favorite and recently used tracks

Mark favorites from the Track menu and view them under the star icon in the top
right of the Available tracks widget.

<Figure caption="Add a track to your list of favorite tracks from the Track menu, then view them in the top right menu." src="/img/favorite_tracks.png" />

Recently opened tracks are listed under the clock icon.

<Figure caption="Selected tracks will be added to a recently used list, then they can be viewed using the top right menu." src="/img/recent_tracks.png" />

## Feature details

Clicking a feature opens its details panel in the drawer. The Attributes section
lists the fields as they came out of the file: a GFF3 attribute, a BED extra
column, or a VCF INFO key appears under its own name.

Two things happen to values on the way in, with no configuration:

- **A value that is just a URL becomes a link**, so a GFF3 attribute like
  `url=https://www.uniprot.org/uniprotkb/P12345` is clickable
- **HTML is rendered rather than escaped**, after a sanitizer. Text that only
  looks like a tag is left alone, so a VCF `<TRA>` allele still reads as `<TRA>`

To add, rename or hide fields, see
[customizing feature details](/docs/config_guides/customizing_feature_details).
Gene and transcript features also have a sequence panel, covered in
[](/docs/user_guides/feature_sequence).

## About track dialog

Opened from the track menu.

<Figure caption="The 'About track' dialog for a CRAM file, showing the full CRAM header and the config info." src="/img/about_track.png"/>

On a **reference sequence track** the dialog also has an "Assembly" section: the
assembly's config (name, aliases, and the alias, cytoband and genetic-code files
it loads), a "Copy assembly config" button, and "Show ref name aliases", which
lists every reference name next to the other names it answers to. That listing
has a filter box, so it is how to look up what one contig is called elsewhere.

## Editing track configs

**Track actions → Settings** in the track menu edits any track's settings. For
non-admin users, edits are saved as a "session track" override that shadows the
original, so they persist and share with the session without touching the
admin-owned track. In admin mode, edits change the track config in place.

<Figure caption="Opening Settings from the track menu's Track actions submenu to edit any track's configuration directly." src="/img/edit_track_settings.png" />

The editor has a filter box to search options by name and tucks rarely-needed
settings behind a **Show advanced settings** toggle. With more than one display
type, only the active display's settings are expanded. **Reset track settings**
in the track menu reverts to the underlying config.

### Pinning a setting as your default

Many track-menu settings (color-by scheme, read and feature height,
soft-clipping, and more) carry a small **pin**. Clicking it makes that value the
default for every track of the same type, and clicking again clears it. Every
open track a default affects is badged in the track selector. See
[defaults for all tracks](/docs/user_guides/display_defaults) for what follows a
default, what keeps its own value, and where defaults are kept.

The [display settings tutorial](/docs/tutorials/display_settings) covers the
same settings as persistent defaults in `config.json`, and as overrides in a URL
or an embedded session.

## Rubberband selection

Click and drag on either the main (lower) or overview (upper) scale bar.

<Figure caption="Rubberbanding the main and overview scalebars. The main one produces extra options on selection." src="/img/rubberband.png" />

The main scale bar's menu holds **Zoom to region**, **Get sequence**, **Copy
range**, **Highlight region** and **Bookmark region**, plus a **Launch** submenu
of what the loaded plugins can start from the selection:

- [](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at),
  when a synteny dataset in the session covers this assembly. It opens one panel
  per assembly aligning to the selection, whether or not the synteny track is
  turned on
- [](/docs/user_guides/consensus_sequence), when an alignments track is open

Each of these has a track-menu twin that takes the visible window instead of a
selection: **Get sequence (visible region)** on the reference sequence track,
**Consensus sequence (visible region)** on an alignments track, and the synteny
launch's own
[visible-region entry](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at).

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

Four layout controls, reached from the view's hamburger menu or the header bar.

### Show ideogram

When the assembly has
[cytobands](/docs/config_guides/assemblies#configuring-cytoband-ideograms), the
overview bar draws the chromosome as a banded ideogram with the centromere
marked. **Show ideogram** toggles it, on by default and remembered for later
sessions.

The entry is absent unless the view shows a whole chromosome, since a sub-region
gives an arbitrary slice of bands.

### Track label positioning

Track labels sit on their own row, overlap the data, or hide entirely, from the
**Track labels** heading under **Show...** in the view's hamburger menu.

<Figure caption="The overlap and offset track label positioning options." src="/img/tracklabels.png" />

### Horizontally flip

**Horizontally flip** in the view's hamburger menu reverse-complements the view.
Triangles in the overview bar show the current orientation.

<Figure caption="Before and after horizontally flipping." src="/img/horizontally_flip.png" links="Normal orientation=horizontally_flip_before,Flipped=horizontally_flip_after" />

### Drawer widget position

The header bar dropdown moves the drawer widget to the left or right side. It
starts on the right.

<Figure caption="Toggling drawer widget to the left side of the screen" src="/img/drawer_widget_toggle.png" />

## Faceted track selector

The filter icon in the top right of the "Available tracks" widget shows all
tracks as a filterable table. Tracks with `metadata` fields get extra filterable
columns:

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
- [](/docs/user_guides/bookmark_widget)
- [](/docs/user_guides/plugin_store)
- [Track selector configuration](/docs/config_guides/track_selector)
- [](/docs/config_guides/avoiding_stale_config)
- [](/docs/config_guides/file_types)
