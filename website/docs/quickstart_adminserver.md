---
title: JBrowse CLI admin server
description:
  Configure assemblies and tracks through a browser GUI that writes config.json
  for you
---

:::caution

The [CLI quickstart](/docs/quickstart_web/) is the recommended way to build a
config. The admin-server is for occasional GUI editing.

:::

The JBrowse CLI's `admin-server` serves JBrowse 2 locally in "admin mode", where
the Assembly manager, the Add track form and the connection form write their
changes back to `config.json`. The writes only happen while the server runs.

:::warning

The `admin-server` is for temporary configuration, **not for production.**

:::

## Prerequisites

- [JBrowse CLI](/docs/quickstart_web/#install-and-run)
- [JBrowse 2 web application](/docs/quickstart_web/#install-and-run)

## Starting JBrowse 2 admin server

From inside your JBrowse 2 directory:

```bash
jbrowse admin-server
```

Open the printed link in your browser:

```
Admin server started on port 9090

To access the admin interface, open your browser to:
http://localhost:9090?adminKey=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6

Admin key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
Config file: /path/to/config.json

To stop the server, press Ctrl+C
```

## Adding a genome assembly

Open the Assembly manager from the menu bar. It lists, creates, edits and
deletes assemblies:

<Figure caption="Screenshot showing the assembly manager, with no assemblies loaded yet." src="/img/assembly_manager.png"/>

To add hg38, press **Add new assembly**, then **Open from a URL**, and paste the
FASTA and its two indexes, one per line:

```
https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz
https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai
https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi
```

The form pairs the indexes with the FASTA and fills in a name from the filename.
Set the name to `hg38`, which is what the rest of this page calls it.

<Figure caption="Assembly manager page for adding a new assembly." src="/img/hg38_assembly_table.png"/>

<Video src="/media/ui/add_genome.mp4" caption="A JBrowse with no genome in it getting one: Tools, Assembly manager, Add new assembly, and three URLs pasted into a single box, which the form answers with the adapter it recognized and a name it filled in." />

**Submit** puts hg38 in the list:

<Figure caption="The assembly manager dialog box with human assemblies available" src="/img/add_hg38_assembly.png"/>

### Editing a genome assembly

The pencil icon in the Assembly manager edits an assembly, and the same table
deletes them.

## Adding a track

Open the Add track form from the menu bar:

<Figure caption="JBrowse 2 file menu with the 'Add track' form" src="/img/add_track_form.png"/>

The circular "+" button in the track selector opens the same form:

<Figure caption="The 'Add track' form can be launched from the circular '+' button in the bottom righthand corner" src="/img/add_track_tracklist.png"/>

Provide a URL or select a local file. Supported formats and index types:
[](/docs/config_guides/file_types). Plugins add further formats; see the
[plugin store](/docs/user_guides/plugin_store).

### Editing a track

In a Linear Genome View, click "Select tracks". Each track's three-dot (...)
menu has a "Settings" button that opens the configuration editor. Edits apply
live and, through the admin-server, persist to the config file.

## Setting a default session

The default session is what a visitor sees first. Open the Set default session
form from the Admin menu:

<Figure caption="The 'Set default session' will persist your current session into the config file so any subsequent visitors to the app will see this session." src="/img/default_session_form.png"/>

The form clears the default session, or sets it to the current session or any
previously saved one.

## See also

- [Quickstart web](/docs/quickstart_web)
- [](/docs/config_guides/file_types)
- [](/docs/config_guides/default_session)
- [Assembly configuration guide](/docs/config_guides/assemblies)
- [](/docs/config_guide)
