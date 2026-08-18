---
title: JBrowse desktop quick start
description: Install JBrowse Desktop, open a genome, and add your first tracks
data: download
---

In this guide, we'll install JBrowse desktop, open a genome, add a track, and
save a session, all from the GUI, with no command line or web server required.
Unlike JBrowse web, desktop opens files straight off your local filesystem, so
there's no `--load copy`, no hosting, and no CORS to worry about. Want a hosted
browser instead? See the [web quick start](/docs/quickstart_web). Embedding a
genome view in your own web app? See
[embedded components](/docs/embedded_components).

## Installing JBrowse desktop

Go to the [download page](/download/) and download the installer for your
platform, or grab the latest release directly from
[GitHub releases](https://github.com/GMOD/jbrowse-components/releases/latest).

### Installing on Windows

Download the latest Windows installer executable (`.exe`) and double-click it to
install and open JBrowse.

### Installing on macOS

Download the latest macOS release artifact (`.dmg`), open it, then drag JBrowse
to Applications.

### Installing on Linux

Download the latest Linux AppImage release (`.AppImage`) and start it in one of
two ways.

In the terminal, make the file executable, then run it:

```sh
# Make the AppImage file executable, only need to do this once
chmod a+x jbrowse-desktop-*-linux.AppImage
# Run!
./jbrowse-desktop-*-linux.AppImage
```

In your file explorer, right-click the AppImage, open "Properties", go to the
"Permissions" tab, and check "Allow executing file as program" (steps may vary
by distribution). You can now double-click the AppImage to launch JBrowse.

## The start screen

After starting JBrowse Desktop, you'll see a start screen with two panels:

<Figure src="/img/desktop-landing.png" caption="The JBrowse desktop start screen. The left panel launches new sessions; the right panel lists recently opened ones."/>

The left panel, "Launch new session", starts a new session from your own genome
or a pre-loaded one:

- **Open new genome** loads a custom genome from local files or URLs (see
  [Opening a genome](#opening-a-genome)).
- **Show all available genomes** browses and launches from a searchable table of
  publicly available reference genomes.
- **Favorite genomes** and **Quickstart list** are one-click launchers for
  genomes you've starred or saved.

The right panel, "Recently opened sessions", holds sessions you've saved, plus
autosaves. Click a session name to reopen it (see
[Saving and reopening sessions](#saving-and-reopening-sessions)).

## Opening a genome

**Open new genome** brings up the "Open genome(s)" dialog, and what you give it
there becomes a new session on that assembly.

<Figure src="/img/desktop-open-genome-steps.png" caption="Opening a genome from your own files. Open new genome (1) brings up the dialog, which takes the sequence file either from the drop area (2) or from pasted URLs (3)."/>

The dialog is drop-first. Drop your sequence file (a FASTA, bgzip-compressed
FASTA, or 2bit, along with any `.fai`/`.gzi` index files) onto the drop area, or
click it to browse. To load from the web instead, click **Open from a URL** and
paste your file URLs, one per line. JBrowse classifies each file, and once it
recognizes a sequence it shows a confirmation card with a **Genome name** field
(e.g. `hg38`). The drop area and the URL box stay where they are, so a `.fai`
you forgot can go in after the sequence is already recognized. Anything JBrowse
can't place, or can't use with the format it detected, it names rather than
loading in silence.

If a filename doesn't match the conventions JBrowse detects, it offers **Enter
details manually**, opening a form with a **Format** dropdown:

- `FASTA with index (.fa + .fai)`
- `Compressed FASTA (.fa.gz + .fai + .gzi)` (bgzip-compressed)
- `FASTA (automatically indexed)` - a plain FASTA with no index. JBrowse builds
  one on open, reading the whole file (and downloading all of it first if it's a
  URL), so this can take a while on a large genome. **Cancel** stops it — supply
  a `.fai` and choose "FASTA with index" to skip the step entirely
- `2bit file (.2bit)`

Click **More options** to set an assembly display name, refName aliases (e.g. to
treat `chr1` and `1` as the same contig), or cytoband data. To load several
genomes at once for comparative views, click **Add another genome** to stage the
current one and start on the next. When you're ready, click **Open** (shown as
**Open N genomes** once you've staged more than one). A linear genome view opens
on the new assembly, ready for tracks.

### Using a pre-loaded genome

If you just want a common reference genome, use **Show all available genomes**
instead. No files are needed. The table is searchable by name, scientific name,
or accession, and grouped by source (UCSC main genomes, GenArk, and so on). Star
a genome to add it to the **Favorite genomes** quick-launch list on the start
screen.

<Figure src="/img/desktop-available-genomes-steps.png" caption="Launching a public assembly. Show all available genomes (1) opens the table, and launch (2) opens a session on that genome, here T2T CHM13v2.0/hs1 with the assembly's hub tracks listed in the track selector."/>

The **Quickstart list** works the same way for genomes you've saved yourself
(see
[Saving a genome to the quickstart list](#saving-a-genome-to-the-quickstart-list)).
Check multiple entries and click **Go** to open them together in one combined
session, handy for comparative genomics.

## Adding tracks

Once a genome is open, add data tracks from local files or URLs.

Open the **File** menu and choose **Open track...**, or open the track selector
and use its **Add track** button. Either opens the "Add a track" form.

<Figure src="/img/desktop-add-track-steps.png" caption="Adding a track. File then Open track... (1) opens the form, which takes a main file as a local path or a URL (2) and infers the index from it (3). Confirming the guessed track type adds the track to the open view, the third frame."/>

- Choose **Add a track from file or URL**.
- Set the **Main file** (the data file) and optionally an **Index file**. For
  formats that need one (BAM/CRAM/tabix), the index URL is inferred from the
  main file if you leave it blank. You can pick local files or paste URLs.
- Click **Next**. JBrowse guesses the **Track type** and **Adapter type** from
  the file; confirm or adjust them, set a **Track name**, and pick the assembly
  to add the track to.
- Click **Add**.

JBrowse desktop supports the same file formats as JBrowse web. See
[](/docs/config_guides/file_types). For the indexing and preparation commands
behind these formats, see the [web quick start](/docs/quickstart_web).

To load many tracks at once, choose **Add multiple tracks at once** in the "Add
a track" form.

### Gene annotations (GFF3 and GTF)

Both load through the same form, and a plain `.gff3` or `.gtf` needs no index —
pick the file and desktop reads it. That is the fast path for one chromosome's
worth of annotation.

Sort, bgzip and tabix anything genome-scale before loading it. An unindexed file
is parsed once and held whole in memory, so a full annotation costs that much
resident before the first feature draws. The commands are in the
[web quick start](/docs/quickstart_web) under GFF3 and GTF; `jbrowse sort-gff`
handles both formats. Give the form the `.gff.gz` or `.gtf.gz` as the main file
and it infers the `.tbi` beside it.

### Connecting to a track hub

To pull in a whole set of tracks at once, use **File → Open connection...** and
point it at a UCSC track hub or a JBrowse hub. The connection's tracks then
appear in the track selector alongside any you added by hand.

### Making tracks searchable by name

To search a track by gene name or feature ID from the location box, index its
feature names: open the track's menu (the **⋮** button on the track, or its
entry in the track selector) and choose **Index track**. Indexing runs as a
background job; when it finishes, names from that track can be typed straight
into the search box. This is the in-app equivalent of the CLI
`jbrowse text-index` command.

**Index track** only appears on a track it can index — GFF3, GTF and VCF, plain
or tabix-indexed. A track of any other type has no such item, which is the
answer when the menu does not offer it.

## Saving and reopening sessions

JBrowse desktop autosaves your work continuously, and autosaves show up in
"Recently opened sessions" on the start screen.

To save a named session to a file, use **File → Session → Save session as...**
This writes a `.jbrowse` file you can reopen later (or share). Reopen one with
**File → Session → Open config.json or .jbrowse file...**, or from the start
screen's **Open .jbrowse or config.json or link** menu.

To hand a session off to someone running JBrowse web, use **File → Session →
Export session to web...**, which produces a shareable URL.

### Opening a JBrowse web link

The reverse direction works too, in JBrowse Desktop 5.0 and newer: **Open
.jbrowse or config.json or link → Open JBrowse Web link...** on the start
screen, or **File → Session → Open JBrowse Web link...** once a session is open.
Either takes a JBrowse web URL and rebuilds it here as a new session. Two link
forms work:

- one containing a [session spec](/docs/urlparams/#session-spec)
  (`&session=spec-...`) — for example the "Open this view in JBrowse" link under
  any figure in these docs
- one using the [URL parameter](/docs/urlparams/) shorthand, i.e. `&assembly=`
  with an optional `&loc=`, `&tracks=`, `&highlight=` and so on
- one naming a track hub with `&hubURL=`, which is attached as a connection; add
  `&assembly=` naming one of the hub's genomes to open at a particular place in
  it, or leave it off to land at the hub's own default position

The config the link names is downloaded and saved alongside the session, so it
reopens later like any other. Share links (`&session=share-...`) can't be opened
this way: only the JBrowse web instance that created one can resolve it.

Figures in these docs also offer an "Open this view in JBrowse Desktop" button,
which hands the view straight to Desktop through a `jbrowse://` link that the
macOS and Windows installers register for you. **The Linux AppImage doesn't
register anything by itself**, so that button generally won't work there unless
you've integrated the AppImage with your desktop (e.g. with
[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher)): paste the
link instead, or pass it on the command line (below).

### Saving a genome to the quickstart list

To turn a session into a reusable quickstart entry, select it in "Recently
opened sessions" and choose **Add to quickstart list** (the playlist-add icon in
list view, or the entry's action menu). It then appears in the **Quickstart
list** on the left panel for one-click launching.

## Launching from the command line

If you start JBrowse Desktop from a terminal, you can pass a session
(`.jbrowse`) or a configuration (`config.json`) file to open it straight away,
skipping the start screen:

```sh
# Linux AppImage
./jbrowse-desktop-*-linux.AppImage myproject/config.json

# Linux (installed) / Windows
jbrowse-desktop mysession.jbrowse

# macOS
open -a "JBrowse 2" myproject/config.json
```

Relative paths inside a `config.json` are resolved against that file's own
folder, so a config the [CLI builds](/docs/tutorials/cli_desktop) opens with no
extra setup.

A `jbrowse://` link works as an argument too, which is the simplest way to open
one on Linux, where the AppImage doesn't register the URL scheme itself (quote
it, so the shell leaves the `&` alone):

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

`--renderer` is useful when WebGPU is unavailable or misbehaving, for example
running over X11 forwarding or a remote desktop. Use `webgl` first, and `canvas`
only if WebGL is also unavailable.

## See also

- [](/docs/user_guide)
- [](/docs/config_guide)
- [Web quick start](/docs/quickstart_web)
- [](/docs/faq)
