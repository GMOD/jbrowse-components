---
title: JBrowse desktop quick start
description: Install JBrowse Desktop, open a genome, and add your first tracks
data: download
---

Install JBrowse desktop, open a genome, add a track, and save a session, all
from the GUI. Desktop reads files straight off your local filesystem, so there
is no command line or web server.

Other ways to run JBrowse:

- [JBrowse web](/docs/quickstart_web) - a hosted browser served as static files
- [](/docs/embedded_components) - embed a view in your own web app

## Installing JBrowse desktop

Download the installer for your platform from the [download page](/download/) or
[GitHub releases](https://github.com/GMOD/jbrowse-components/releases/latest).

### Installing on Windows

Double-click the `.exe` installer.

### Installing on macOS

Open the `.dmg` and drag JBrowse to Applications.

### Installing on Linux

Make the `.AppImage` executable, then run it:

```sh
chmod a+x jbrowse-desktop-*-linux.AppImage
./jbrowse-desktop-*-linux.AppImage
```

Or from a file explorer: right-click the AppImage, open "Properties", check
"Allow executing file as program" under "Permissions", and double-click it.

## The start screen

<Figure src="/img/desktop-landing.png" caption="The JBrowse desktop start screen. The left panel launches new sessions; the right panel lists recently opened ones."/>

The left panel, "Launch new session", starts a session on a genome:

- **Open new genome** loads a genome from local files or URLs (see
  [Opening a genome](#opening-a-genome))
- **Show all available genomes** launches from a searchable table of public
  reference genomes
- **Favorite genomes** and **Quickstart list** are one-click launchers for
  genomes you've starred or saved

The right panel, "Recently opened sessions", lists saved sessions and autosaves.
Click one to reopen it (see
[Saving and reopening sessions](#saving-and-reopening-sessions)).

## Opening a genome

**Open new genome** brings up the "Open genome(s)" dialog. What you give it
becomes a new session on that assembly.

<Figure src="/img/desktop-open-genome-steps.png" caption="Opening a genome from your own files. Open new genome (1) brings up the dialog, and the sequence file goes onto its drop area (2)."/>

Drop your sequence file onto the drop area, or click it to browse. For files on
the web, click **Open from a URL** and paste the URLs, one per line. JBrowse
classifies each file, and once it recognizes a sequence it shows a confirmation
card with a **Genome name** field (e.g. `hg38`). A forgotten `.fai` can be
dropped in after the sequence is already recognized.

Accepted sequence formats:

- `FASTA with index (.fa + .fai)`
- `Compressed FASTA (.fa.gz + .fai + .gzi)` (bgzip-compressed)
- `FASTA (automatically indexed)` - a plain FASTA. JBrowse builds the index on
  open, reading the whole file, which can take a while on a large genome. Supply
  a `.fai` to skip it
- `2bit file (.2bit)`
- `Chromosome sizes, no sequence (.chrom.sizes)` - reference names and lengths
  with no bases behind them. Enough for whole-genome and synteny views at a
  fraction of the size, and the dialog warns what it costs[^chromsizes]

If a filename doesn't match what JBrowse detects, **Enter details manually**
opens a form with a **Format** dropdown listing the same choices.

Three buttons finish the dialog:

- **More options** sets a display name, refName aliases (e.g. to treat `chr1`
  and `1` as the same contig), or cytoband data
- **Add another genome** stages the current genome and starts on the next, for
  comparative views
- **Open** (**Open N genomes** once several are staged) opens a linear genome
  view on the new assembly

### Using a pre-loaded genome

For a common reference genome, use **Show all available genomes**, which needs
no files. The table is searchable by name, scientific name, or accession, and
grouped by source (UCSC main genomes, GenArk, and so on). Star a genome to add
it to **Favorite genomes** on the start screen.

<Figure src="/img/desktop-available-genomes-steps.png" caption="Launching a public assembly. Show all available genomes (1) opens the table, and launch (2) opens a session on that genome, here T2T CHM13v2.0/hs1 with the assembly's hub tracks listed in the track selector."/>

The **Quickstart list** works the same way for genomes you've saved (see
[Saving a genome to the quickstart list](#saving-a-genome-to-the-quickstart-list)).
Check several entries and click **Go** to open them in one combined session.

## Adding tracks

Open the **File** menu and choose **Open track...**, or click **Add track** in
the track selector. Either opens the "Add a track" form.

<Figure src="/img/desktop-add-track-steps.png" caption="Adding a track. File then Open track... (1) opens the form, which takes a main file as a local path or a URL (2) and infers the index from it (3). Confirming the guessed track type adds the track to the open view, the third frame."/>

- Choose **Add a track from file or URL**
- Set the **Main file**, as a local file or a URL. For BAM/CRAM/tabix formats
  the **Index file** is inferred from the main file if left blank
- Click **Next**. JBrowse guesses the **Track type** and **Adapter type**;
  confirm or adjust them, set a **Track name**, and pick the assembly
- Click **Add**

Desktop supports the same formats as JBrowse web; see
[](/docs/config_guides/file_types). The indexing commands behind them are in the
[web quick start](/docs/quickstart_web). To load many tracks at once, choose
**Add multiple tracks at once** in the form.

### Gene annotations (GFF3 and GTF)

A plain `.gff3` or `.gtf` needs no index; pick the file and desktop reads it.
That is fine for one chromosome's worth of annotation.

Anything genome-scale should be sorted, bgzipped and tabix-indexed first,
because an unindexed file is parsed once and held whole in memory. The commands
are in the [web quick start](/docs/quickstart_web) under GFF3 and GTF. Give the
form the `.gff.gz` or `.gtf.gz` and it infers the `.tbi` beside it.

### Connecting to a track hub

**File → Open connection...** takes a UCSC track hub or a JBrowse hub and lists
its tracks in the track selector alongside your own.

### Making tracks searchable by name

Open the track's menu (the **⋮** button on the track, or its entry in the track
selector) and choose **Index track**. Indexing runs as a background job; once
done, names from that track can be typed into the location search box. This is
the in-app equivalent of `jbrowse text-index`.

**Index track** only appears on GFF3, GTF and VCF tracks, plain or
tabix-indexed.

## Saving and reopening sessions

Desktop autosaves continuously, and autosaves appear in "Recently opened
sessions" on the start screen. The **File → Session** menu handles named
sessions:

- **Save session as...** writes a `.jbrowse` file you can reopen or share
- **Open config.json or .jbrowse file...** reopens one, as does the start
  screen's **Open file or link** menu
- **Export session to web...** produces a URL for someone running JBrowse web

### Opening a JBrowse web link

The reverse direction works in JBrowse Desktop 5.0 and newer: **Open file or
link → Open JBrowse Web link...** on the start screen, or **File → Session →
Open JBrowse Web link...** in a session. Either rebuilds a JBrowse web URL as a
new session. Link forms that work:

- a [session spec](/docs/urlparams/#session-spec) (`&session=spec-...`), such as
  the "Open this view in JBrowse" link under any figure in these docs
- the [URL parameter](/docs/urlparams/) shorthand, i.e. `&assembly=` with an
  optional `&loc=`, `&tracks=`, `&highlight=` and so on
- a track hub with `&hubURL=`, attached as a connection; add `&assembly=` naming
  one of the hub's genomes to open at a particular place in it

The config the link names is downloaded and saved with the session, so it
reopens later like any other. Share links (`&session=share-...`) can't be opened
this way; only the JBrowse web instance that created one can resolve it.

Figures in these docs also offer an "Open this view in JBrowse Desktop" button,
a `jbrowse://` link that the macOS and Windows installers register. **The Linux
AppImage doesn't register anything by itself**, so on Linux paste the link
instead, pass it on the command line (below), or integrate the AppImage with
[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

### Saving a genome to the quickstart list

Select a session in "Recently opened sessions" and choose **Add to quickstart
list** (the playlist-add icon in list view, or the entry's action menu). It then
appears in the **Quickstart list** for one-click launching.

## Launching from the command line

Pass a session (`.jbrowse`) or a configuration (`config.json`) file to skip the
start screen:

```sh
# Linux AppImage
./jbrowse-desktop-*-linux.AppImage myproject/config.json

# Linux (installed) / Windows
jbrowse-desktop mysession.jbrowse

# macOS
open -a "JBrowse 2" myproject/config.json
```

Relative paths inside a `config.json` resolve against that file's own folder, so
a config the [CLI builds](/docs/tutorials/cli_desktop) opens with no extra
setup.

A `jbrowse://` link works as an argument too, quoted so the shell leaves the `&`
alone:

```sh
./jbrowse-desktop-*-linux.AppImage 'jbrowse://open?url=https%3A%2F%2Fjbrowse.org%2F...'
```

Other flags:

```sh
jbrowse-desktop --renderer webgl   # force WebGL instead of auto-detecting WebGPU
jbrowse-desktop --renderer canvas  # force the Canvas2D fallback
jbrowse-desktop --version          # print the version and exit
jbrowse-desktop --help             # print usage and exit
```

`--renderer` helps when WebGPU is unavailable or misbehaving, for example over
X11 forwarding or a remote desktop. Try `webgl` first, and `canvas` only if
WebGL is also unavailable.

## See also

- [](/docs/user_guide)
- [](/docs/config_guide)
- [Web quick start](/docs/quickstart_web)
- [](/docs/faq)

[^chromsizes]:
    A `.chrom.sizes` is a UCSC-style `name<TAB>length` table. The six wheat
    genomes behind
    [Synteny from OrthoFinder orthogroups](/docs/tutorials/orthofinder_synteny)
    are tens of gigabytes as sequence and a few kilobytes as chrom.sizes. With
    no bases, the sequence track and GC content draw nothing, CRAM cannot decode
    without the reference, and a feature has no DNA or protein sequence to show.
    Dropping a `.chrom.sizes` on the drop area selects this format on its own.
