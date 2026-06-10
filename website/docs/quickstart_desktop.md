---
title: JBrowse desktop quick start
---

In this guide, we'll install JBrowse desktop, open a genome, add a track, and
save a session — all from the GUI, with no command line or web server required.
Unlike JBrowse web, desktop opens files straight off your local filesystem, so
there's no `--load copy`, no hosting, and no CORS to worry about.

## Installing JBrowse desktop

Go to the [download page](/jb2/download/) and download the installer for your
platform, or grab the latest release directly from
[GitHub releases](https://github.com/GMOD/jbrowse-components/releases/latest).

### Installing on Windows

Download the latest Windows installer executable (`.exe`) and double-click it to
install and open JBrowse.

### Installing on MacOS

Download the latest MacOS release artifact (`.dmg`), open it, then drag JBrowse
to Applications.

### Installing on Linux

Download the latest Linux AppImage release (`.AppImage`) and start it in one of
two ways.

**In the terminal** — make the file executable, then run it:

```sh
# Make the AppImage file executable, only need to do this once
chmod a+x jbrowse-desktop-*-linux.AppImage
# Run!
./jbrowse-desktop-*-linux.AppImage
```

**In your file explorer** — right-click the AppImage, open "Properties", go to
the "Permissions" tab, and check "Allow executing file as program" (steps may
vary by distribution). You can now double-click the AppImage to launch JBrowse.

## The start screen

After starting JBrowse Desktop, you'll see a start screen with two panels:

<Figure src="/img/desktop-landing.png" caption="The JBrowse desktop start screen. The left panel launches new sessions; the right panel lists recently opened ones."/>

**Left panel — "Launch new session".** Start a new session from your own genome
or a pre-loaded one:

- **Open new genome** — load a custom genome from local files or URLs (see
  [Opening a genome](#opening-a-genome)).
- **Show all available genomes** — browse and launch from a searchable table of
  publicly available reference genomes.
- **Favorite genomes** and **Quickstart list** — one-click launchers for genomes
  you've starred or saved.

**Right panel — "Recently opened sessions".** Sessions you've saved, plus
autosaves. Click a session name to reopen it (see
[Saving and reopening sessions](#saving-and-reopening-sessions)).

## Opening a genome

Click **Open new genome** to bring up the "Open genome(s)" dialog. It has two
modes:

- **Guided** — pick a **Format**, then choose the matching files. Supported
  formats:
  - `FASTA with index (.fa + .fai)`
  - `Compressed FASTA (.fa.gz + .fai + .gzi)` (bgzip-compressed)
  - `FASTA (index will be generated)` — a plain FASTA with no index; JBrowse
    builds one on submit (downloads the whole file first if it's a URL, so this
    can take a minute)
  - `2bit file (.2bit)`
- **Drop / paste files** — drag your sequence file (plus any `.fai`/`.gzi` index
  files) onto the drop area, or paste file URLs one per line. JBrowse detects
  the format automatically.

Set an **Assembly name** (e.g. `hg38`), then click **Open**. Use **Advanced
options** to set a human-readable display name, refName aliases (e.g. to treat
`chr1` and `1` as the same contig), or cytoband data. To load several genomes at
once for comparative views, use **Stage this genome and add another**.

### Using a pre-loaded genome

If you just want a common reference genome, click **Show all available genomes**
to open a searchable table of public assemblies. Find your genome by name,
scientific name, or accession, and launch it directly — no files needed. Star a
genome to add it to the **Favorite genomes** quick-launch list on the start
screen.

The **Quickstart list** works the same way for genomes you've saved yourself
(see
[Saving a genome to the quickstart list](#saving-a-genome-to-the-quickstart-list)).
Check multiple entries and click **Go** to open them together in one combined
session — handy for comparative genomics.

## Adding tracks

Once a genome is open, add data tracks from local files or URLs.

Open the **File** menu and choose **Open track...**, or open the track selector
and use its **Add track** button. Either opens the "Add a track" form:

- Choose **Add a track from file or URL**.
- Set the **Main file** (the data file) and optionally an **Index file** — for
  formats that need one (BAM/CRAM/tabix), the index URL is inferred from the
  main file if you leave it blank. You can pick local files or paste URLs.
- Click **Next**. JBrowse guesses the **Track type** and **Adapter type** from
  the file; confirm or adjust them, set a **Track name**, and pick the assembly
  to add the track to.
- Click **Add**.

The new track appears in the track selector — turn it on to display it.

<Figure src="/img/desktop-session.png" caption="A loaded session in JBrowse desktop, with a linear genome view open."/>

JBrowse desktop supports the same file formats as JBrowse web, including BAM,
CRAM, VCF (bgzip + tabix), BigWig, BigBed, GFF3 (bgzip + tabix), and synteny
formats (PAF, `.delta`, `.chain`, `.anchors`, `.out`). For the indexing and
preparation commands behind these formats, see the
[web quick start](/docs/quickstart_web).

:::note

To load many tracks at once, choose **Add multiple tracks at once** in the "Add
a track" form.

:::

## Saving and reopening sessions

JBrowse desktop autosaves your work continuously, and autosaves show up in
"Recently opened sessions" on the start screen.

To save a named session to a file, use **File → Save session as...** This writes
a `.jbrowse` file you can reopen later (or share). Reopen one with **File → Open
session...**, or with the **Open saved session (.jbrowse) file** button on the
start screen.

### Saving a genome to the quickstart list

To turn a session into a reusable quickstart entry, select it in "Recently
opened sessions" and choose **Add to quickstart list** (the playlist-add icon in
list view, or the entry's action menu). It then appears in the **Quickstart
list** on the left panel for one-click launching.

## Next steps

- [User guide](/docs/user_guide) — track types, views, and UI features
- [Config guide](/docs/config_guide) — advanced track and assembly configuration
- [Web quick start](/docs/quickstart_web) — file format preparation commands
  (indexing FASTA/BAM/VCF/GFF) that apply to desktop too
- [FAQ](/docs/faq) — common questions including text searching
