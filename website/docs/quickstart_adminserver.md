---
title: Admin server GUI (experimental)
---

:::caution

The admin server GUI is not actively tested and may not reflect the current
state of the application. For a more reliable setup, use the
[JBrowse CLI quickstart](/docs/quickstart_web/) instead.

:::

This guide covers configuring JBrowse 2 — adding assemblies and tracks — through
the graphical admin interface.

## Prerequisites

This tutorial requires the following software:

- [JBrowse CLI](/docs/quickstart_web/#installing-the-jbrowse-cli)

- [JBrowse 2 web application](/docs/quickstart_web/#download-jbrowse-2)

## Starting JBrowse 2 admin server

The JBrowse CLI includes an `admin-server` tool that serves JBrowse 2 locally
and writes any configuration changes back to a config file.

:::warning

The `admin-server` is meant to be used temporarily for configuration, **not in
production.**

:::

The `admin-server` launches an instance of JBrowse 2 in "admin mode", which then
lets you:

- Add and edit assemblies with the "Assembly manager"
- Add tracks and edit tracks
- Add and edit connections

All changes are written to the JBrowse config file (usually `config.json`). This
only works while the `admin-server` is running.

To start the `admin-server`, navigate into your JBrowse 2 directory and run:

```bash
## Start the admin-server
jbrowse admin-server
```

This prints a link you can visit in your web browser:

```
Admin server started on port 9090

To access the admin interface, open your browser to:
http://localhost:9090?adminKey=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6

Admin key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
Config file: /path/to/config.json

To stop the server, press Ctrl+C
```

## Adding a genome assembly

A key first step in configuring a genome browser is adding an assembly to view.
To do this, open the Assembly manager from the menu bar.

This opens a table to create, edit, and delete assemblies in your application:

<Figure caption="Screenshot showing the assembly manager, with no assemblies loaded yet." src="/img/assembly_manager.png"/>

As an example, let's add the hg38 human reference genome to our JBrowse 2
application.

Press the "Add New Assembly" button, and enter the necessary information in the
form:

- name: `hg38`
- type: `BgzipFastaAdapter`
- fasta: `https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz`
- fasta index: `https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai`
- gzi: `https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi`

<Figure caption="Assembly manager page for adding a new assembly." src="/img/hg38_assembly_table.png"/>

Click on "Create New Assembly". Great, we've added an assembly! We can see that
we have successfully added the hg38 assembly:

<Figure caption="The assembly manager dialog box with human assemblies available" src="/img/add_hg38_assembly.png"/>

The assembly can be edited or deleted, but for now we will return to the
application.

### Editing a genome assembly

After you've added a genome assembly, you can use the pencil icon button in the
Assembly manager to edit that assembly. You can also delete assemblies from the
assembly manager.

## Adding a track

To add a new track or connection, you can open the Add Track form from the menu
bar in the app:

<Figure caption="JBrowse 2 file menu with the 'Add track' form" src="/img/add_track_form.png"/>

Alternatively, you can use the action button (circular "+") inside the track
selector to access the "Add track" form:

<Figure caption="The 'Add track' form can be launched from the circular '+' button in the bottom righthand corner" src="/img/add_track_tracklist.png"/>

In the "Add track" form, you can provide a URL or select a local file to load.

The following file formats are supported in core JBrowse 2:

- CRAM
- BAM
- VCF (Tabix-indexed)
- GFF3 (Tabix-indexed)
- BED (Tabix-indexed)
- BigBed
- BigWig
- JBrowse 1 nested containment lists (NCLists)
- plain text VCF, BED, CSV, TSV, BEDPE, STAR-fusion output (tabular formats)
- PAF (synteny/dotplot)
- Indexed FASTA/BGZip indexed FASTA
- 2bit
- .hic (Hi-C contact matrix visualization)

Additional data formats can be supported via plugins; check out the
[plugin store](/docs/user_guides/plugin_store).

For tabix files, TBI or CSI indexes are allowed. CSI or BAI is allowed for BAM.
Only CRAI is allowed for CRAM. The index will be inferred for BAI or TBI files
(e.g. `filename.bai`); specify it explicitly if yours differs.

### Editing a track

First, open a Linear Genome View, and click on the "Select Tracks" button.

The configuration settings are accessible by clicking the three-dot (...) menu
on each track. Open the configuration editor for the track by clicking on the
"Settings" button in that menu. You can use the configuration editor to
live-edit any configurable value for a given track, and changes are persisted to
the config file when editing through the admin-server.

## Setting a default session

You can also use the graphical admin server to set the default session of your
JBrowse 2 instance. This is the session that will appear when JBrowse 2 is first
visited. To do so, open the Set default session form (Admin menu):

<Figure caption="The 'Set default session' will persist your current session into the config file so any subsequent visitors to the app will see this session." src="/img/default_session_form.png"/>

You can use the form to clear your default session, select the currently open
session, or any of your previously saved sessions.

## Additional resources

There are a number of additional features for configuring JBrowse 2. Make sure
to refer to the [config guide](/docs/config_guide) for more topics.
