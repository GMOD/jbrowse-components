---
title: JBrowse desktop quick start
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

Click **Open new genome** to bring up the "Open a genome" dialog.

<Figure src="/img/desktop-open-genome.png" caption="The Open a genome dialog. Drop or browse for a sequence file and JBrowse detects the format automatically; a text link switches to loading from URLs instead."/>

The dialog is drop-first. Drop your sequence file (a FASTA, bgzip-compressed
FASTA, or 2bit, along with any `.fai`/`.gzi` index files) onto the drop area, or
click it to browse. To load from the web instead, click **Open from a URL** and
paste your file URLs, one per line. JBrowse classifies each file, and once it
recognizes a sequence it shows a confirmation card with a **Genome name** field
(e.g. `hg38`).

If a filename doesn't match the conventions JBrowse detects, it offers **Enter
details manually**, opening a form with a **Format** dropdown:

- `FASTA with index (.fa + .fai)`
- `Compressed FASTA (.fa.gz + .fai + .gzi)` (bgzip-compressed)
- `FASTA (automatically indexed)` - a plain FASTA with no index. JBrowse builds
  one on open (it downloads the whole file first if it's a URL, so this can take
  a minute)
- `2bit file (.2bit)`

Click **More options** to set an assembly display name, refName aliases (e.g. to
treat `chr1` and `1` as the same contig), or cytoband data. To load several
genomes at once for comparative views, click **Add another genome** to stage the
current one and start on the next. When you're ready, click **Open** (shown as
**Open N genomes** once you've staged more than one).

A linear genome view opens on the new assembly, ready for tracks:

<Figure src="/img/desktop-session.png" caption="A linear genome view open on a freshly loaded assembly, before any tracks are added."/>

### Using a pre-loaded genome

If you just want a common reference genome, click **Show all available genomes**
to open a searchable table of public assemblies. Find your genome by name,
scientific name, or accession, and launch it directly, no files needed. Star a
genome to add it to the **Favorite genomes** quick-launch list on the start
screen.

<Figure src="/img/desktop-available-genomes.png" caption="The Available genomes browser: a searchable, star-to-favorite table of public reference assemblies, each launchable in one click."/>

The **Quickstart list** works the same way for genomes you've saved yourself
(see
[Saving a genome to the quickstart list](#saving-a-genome-to-the-quickstart-list)).
Check multiple entries and click **Go** to open them together in one combined
session, handy for comparative genomics.

## Adding tracks

Once a genome is open, add data tracks from local files or URLs.

Open the **File** menu and choose **Open track...**, or open the track selector
and use its **Add track** button. Either opens the "Add a track" form:

<Figure src="/img/desktop-add-track.png" caption="The Add a track form: choose a main file (local File, URL, or cloud), with the index URL auto-inferred from the main file."/>

- Choose **Add a track from file or URL**.
- Set the **Main file** (the data file) and optionally an **Index file**. For
  formats that need one (BAM/CRAM/tabix), the index URL is inferred from the
  main file if you leave it blank. You can pick local files or paste URLs.
- Click **Next**. JBrowse guesses the **Track type** and **Adapter type** from
  the file; confirm or adjust them, set a **Track name**, and pick the assembly
  to add the track to.
- Click **Add**.

The new track appears in the track selector. Turn it on to display it.

JBrowse desktop supports the same file formats as JBrowse web. See
[Supported file types](/docs/config_guides/file_types). For the indexing and
preparation commands behind these formats, see the
[web quick start](/docs/quickstart_web).

To load many tracks at once, choose **Add multiple tracks at once** in the "Add
a track" form.

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

## Saving and reopening sessions

JBrowse desktop autosaves your work continuously, and autosaves show up in
"Recently opened sessions" on the start screen.

To save a named session to a file, use **File → Session → Save session as...**
This writes a `.jbrowse` file you can reopen later (or share). Reopen one with
**File → Session → Open session...**, or from the start screen's **Open .jbrowse
or config.json or link** menu.

To hand a session off to someone running JBrowse web, use **File → Session →
Export session to web...**, which produces a shareable URL.

### Opening a JBrowse web link

The reverse direction works too, in JBrowse Desktop 5.0 and newer: **Open
.jbrowse or config.json or link → Open JBrowse Web link...** on the start
screen, or **File → Session → Open JBrowse Web link...** once a session is open.
Either takes a JBrowse web URL containing a
[session spec](/docs/urlparams/#session-spec) (such as the "Open this view in
JBrowse" link under any figure in these docs) and rebuilds it here as a new
session. The config the link names is downloaded and saved alongside the
session, so it reopens later like any other. Share links (`&session=share-...`)
can't be opened this way: only the JBrowse web instance that created one can
resolve it.

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

- [User guide](/docs/user_guide) - track types, views, and UI features
- [Config guide](/docs/config_guide) - advanced track and assembly configuration
- [Web quick start](/docs/quickstart_web) - file format preparation commands
  (indexing FASTA/BAM/VCF/GFF) that apply to desktop too
- [FAQ](/docs/faq) - common questions including text searching
