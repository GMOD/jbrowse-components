---
title: JBrowse desktop quick start
description: Install JBrowse Desktop, open a genome, and add your first tracks
---

Install JBrowse Desktop, open a genome, add a track and save a session, all from
the GUI with no command line or web server. Desktop opens files straight off
your local filesystem. For a hosted browser see the
[web quick start](/docs/quickstart_web), and to embed a view in your own web app
see [embedded components](/docs/embedded_components).

## Installing JBrowse desktop

Download the installer for your platform from the [download page](/download/) or
[GitHub releases](https://github.com/GMOD/jbrowse-components/releases/latest).

- **Windows**: run the `.exe` installer.
- **macOS**: open the `.dmg` and drag JBrowse to Applications.
- **Linux**: make the `.AppImage` executable and run it, in a terminal or from
  the file manager's Properties, Permissions, "Allow executing file as program".

```sh
chmod a+x jbrowse-desktop-*-linux.AppImage   # once
./jbrowse-desktop-*-linux.AppImage
```

## The start screen

<Figure src="/img/desktop-landing.png" caption="The JBrowse Desktop start screen."/>

- **Open new genome** loads a genome from local files or URLs
  ([Opening a genome](#opening-a-genome)).
- **Show all available genomes** launches from a searchable table of public
  reference genomes.
- **Favorite genomes** and **Quickstart list** are one-click launchers for
  genomes you have starred or saved.
- **Recently opened sessions**, on the right, holds saved sessions and
  autosaves. Click one to reopen it.

## Opening a genome

**Open new genome** brings up the "Open genome(s)" dialog, and what you give it
becomes a new session on that assembly.

<Figure src="/img/desktop-open-genome-steps.png" caption="Open new genome (1) brings up the dialog, and the sequence file goes onto its drop area (2)."/>

- Drop the sequence file (FASTA, bgzip-compressed FASTA or 2bit, with any `.fai`
  or `.gzi` beside it) onto the drop area, or click it to browse. **Open from a
  URL** takes file URLs, one per line.
- JBrowse classifies each file. Once it recognizes a sequence it shows a
  confirmation card with a **Genome name** field, and the drop area stays put,
  so a forgotten `.fai` can go in afterwards.
- **Enter details manually** opens a form with a **Format** dropdown for a file
  whose name does not match the conventions: indexed FASTA, compressed FASTA,
  plain FASTA (indexed on open, reading the whole file, so supply a `.fai` for a
  large genome), 2bit, or `.chrom.sizes`.
- A `.chrom.sizes` gives the assembly its reference names and lengths and no
  bases, a fraction of the size and enough for whole-genome and synteny views.
  The dialog warns that the sequence track and GC content then draw nothing,
  CRAM cannot decode, and a feature has no sequence to show.
- **More options** sets a display name, refName aliases (`chr1` and `1` as one
  contig) or cytobands. **Add another genome** stages the current one and starts
  on the next, for comparative views. **Open** opens a linear genome view on the
  new assembly.

### Using a pre-loaded genome

**Show all available genomes** needs no files. The table is searchable by name,
scientific name or accession, grouped by source (UCSC, GenArk and so on). Star a
genome to add it to **Favorite genomes**, and check several and click **Go** to
open them in one session for comparative work.

<Figure src="/img/desktop-available-genomes-steps.png" caption="Show all available genomes (1) opens the table, and launch (2) opens a session on that genome."/>

## Adding tracks

Open the **File** menu and choose **Open track...**, or use the track selector's
**Add track** button.

<Figure src="/img/desktop-add-track-steps.png" caption="File → Open track... (1) opens the form, which takes a file or URL (2) and infers its index (3)."/>

- Choose **Add a track from file or URL**, set the **Main file** as a local path
  or URL, and leave the **Index file** blank for BAM, CRAM or tabix files to
  infer it.
- Click **Next**. JBrowse guesses the track and adapter type from the file;
  confirm or adjust them, set a name, pick the assembly, and click **Add**.
- **Add multiple tracks at once** in the same form loads many files together.
- Desktop reads the same formats as JBrowse Web
  ([](/docs/config_guides/file_types)), and the indexing commands are on the
  [web quick start](/docs/quickstart_web#adding-tracks).

### Gene annotations (GFF3 and GTF)

A plain `.gff3` or `.gtf` needs no index, the fast path for one chromosome's
worth of annotation. An unindexed file is parsed once and held whole in memory,
so sort, bgzip and tabix anything genome-scale (`jbrowse sort-gff` handles both
formats) and give the form the `.gz` as the main file; it infers the `.tbi`
beside it.

### Pangenome graphs

A GFA, or a graph indexed by `gfa-to-tabix` or gbz-base, opens from local files
once the GraphGenomeView plugin is installed:
[](/docs/user_guides/graph_genome_view#on-jbrowse-desktop).

### Connecting to a track hub

**File → Open connection...** points at a UCSC track hub or a JBrowse hub, and
its tracks appear in the track selector beside any you added by hand.

### Making tracks searchable by name

Open the track's menu (the **⋮** button on the track, or its entry in the track
selector) and choose **Index track**. Indexing runs as a background job, after
which names from that track can be typed into the location box. It is the in-app
equivalent of `jbrowse text-index`, and appears only on a track it can index:
GFF3, GTF and VCF, plain or tabix-indexed.

## Saving and reopening sessions

JBrowse desktop autosaves continuously, and autosaves show up in "Recently
opened sessions". The **File → Session** menu handles named sessions:

- **Save session as...** writes a `.jbrowse` file you can reopen or share.
- **Open config.json or .jbrowse file...** reopens one, as does the start
  screen's **Open .jbrowse or config.json or link** menu.
- **Export session to web...** produces a shareable URL for someone running
  JBrowse Web.

### Opening a JBrowse web link

**Open JBrowse Web link...**, on the start screen's open menu or under **File →
Session**, takes a JBrowse Web URL and rebuilds it as a new session:

- a [session spec](/docs/urlparams/#session-spec) link (`&session=spec-...`),
  such as the "Open this view in JBrowse" link under any figure in these docs
- the [URL parameter](/docs/urlparams/) shorthand, `&assembly=` with `&loc=`,
  `&tracks=` and `&highlight=`
- a `&hubURL=` link, attached as a connection; `&assembly=` naming one of the
  hub's genomes opens at a place in it
- a link from JBrowse Web's Share button, short (`&session=share-...`, with its
  `&password=`) or long (`&session=encoded-...`); plugins the session added are
  put through the same trust prompt as a config's

Desktop downloads the config the link names and saves it with the session. A
short share link is read from the share service that config names, so it needs a
network connection and the link's `&password=` intact.

JBrowse Web's Share dialog has an "Open in JBrowse Desktop" button that opens
the link it shows, through the same `jbrowse://` link.

Figures in these docs also offer an "Open this view in JBrowse Desktop" button,
through a `jbrowse://` link the macOS and Windows installers register. The Linux
AppImage registers nothing by itself, so there paste the link, pass it on the
command line (below), or integrate the AppImage with
[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

### Saving a genome to the quickstart list

Select a session in "Recently opened sessions" and choose **Add to quickstart
list** (the playlist-add icon, or the entry's action menu). It then appears in
the **Quickstart list** on the left panel.

## Launching from the command line

No installer puts JBrowse Desktop on the `PATH`, so the commands below write
`jbrowse-desktop` for the binary's full path:

- **Linux:** the AppImage you downloaded, `./jbrowse-desktop-*-linux.AppImage`
- **macOS:** `"/Applications/JBrowse 2.app/Contents/MacOS/JBrowse 2"`.
  `open -a "JBrowse 2" <file>` also opens a session, a config or a genome file,
  but drops flags
- **Windows (PowerShell):**
  `& "$env:LOCALAPPDATA\Programs\JBrowse 2\jbrowse-desktop.exe"`

If Desktop is already running, what the command names opens in its window.

### Opening data files

A genome and data files open as a new session, at a location if `--loc` names
one. Desktop takes the arguments [jb2export](/docs/jbrowse-img) takes, so a
command that renders a figure opens the same view once `--out` comes off:

```sh
jbrowse-desktop genome.fa reads.bam calls.vcf.gz --loc chr1:1-100,000
jbrowse-desktop --genome hg38 tumor.bam --track hg38-ncbiRefSeqCurated --loc EGFR
jbrowse-desktop myproject/config.json extra.bw --loc chr1:1-100,000
```

- A FASTA, 2bit or `.chrom.sizes` is the genome, and any other file opens as a
  track, typed by its name. `name:<label>` and `index:<file>` can follow a file.
- A typed flag such as `--bam` or `--bigwig` sets a file's type whatever its
  name says; `jbrowse-desktop --help` lists them.
- `--genome` opens a genome from
  [genomes.jbrowse.org](https://genomes.jbrowse.org), and `--track` adds one of
  its tracks by trackId (`jb2export list hg38` prints them).
- Paths resolve against the directory the command runs in.
- Display settings such as `height:200` are not applied yet; Desktop names the
  ones it skipped once the session opens.

### Opening a session, config or link

A session (`.jbrowse`) or config (`config.json`) alone opens as itself. Relative
paths inside a `config.json` resolve against that file's folder, so a config the
[CLI builds](/docs/tutorials/cli_desktop) opens with no extra setup. A
`jbrowse://` link opens the JBrowse Web view it wraps:

```sh
jbrowse-desktop myproject/config.json
jbrowse-desktop mysession.jbrowse
# quoted so the shell leaves the & alone
jbrowse-desktop 'jbrowse://open?url=https%3A%2F%2Fjbrowse.org%2F...'
```

### Rendering and other flags

```sh
jbrowse-desktop --renderer webgl   # force WebGL instead of auto-detecting WebGPU
jbrowse-desktop --renderer canvas  # force the Canvas2D fallback
jbrowse-desktop --version          # print the version and exit
jbrowse-desktop --help             # print usage and exit
```

`--renderer` is for a machine where WebGPU is unavailable or misbehaving, such
as X11 forwarding or a remote desktop. Try `webgl` first and `canvas` only if
WebGL is also unavailable. The flag takes effect only when Desktop is not
already running. `--mcp` runs the server an AI agent uses to drive Desktop:
[](/docs/agents).

## See also

- [](/docs/user_guide)
- [](/docs/config_guide)
- [Web quick start](/docs/quickstart_web)
- [](/docs/faq)
