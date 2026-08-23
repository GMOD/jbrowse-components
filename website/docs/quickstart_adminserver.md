---
title: JBrowse CLI admin server
description:
  Configure assemblies and tracks through a browser GUI that writes config.json
  for you
---

:::caution

We recommend the [CLI quickstart](/docs/quickstart_web/) for most config setup.
The admin-server is a niche tool for occasional GUI editing.

:::

This guide covers configuring JBrowse 2 (adding assemblies and tracks) through
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

Open the Assembly manager from the menu bar to add an assembly.

This opens a table to create, edit, and delete assemblies in your application:

<Figure caption="Screenshot showing the assembly manager, with no assemblies loaded yet." src="/img/assembly_manager.png"/>

As an example, add the hg38 human reference genome.

Press **Add new assembly**, then **Open from a URL**, and paste the FASTA and
its two indexes into the box, one per line:

```
https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz
https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai
https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi
```

The form recognizes the three files, pairs the indexes with the FASTA, and fills
in a genome name from the filename. That name is editable, and the rest of this
page calls the assembly `hg38`, so set it to that.

<Figure caption="Assembly manager page for adding a new assembly." src="/img/hg38_assembly_table.png"/>

<Video src="/media/ui/add_genome.mp4" caption="A JBrowse with no genome in it getting one: Tools, Assembly manager, Add new assembly, and three URLs pasted into a single box, which the form answers with the adapter it recognized and a name it filled in." />

**Submit** puts hg38 in the list:

<Figure caption="The assembly manager dialog box with human assemblies available" src="/img/add_hg38_assembly.png"/>

### Editing a genome assembly

The pencil icon button in the Assembly manager edits an assembly, and the same
table deletes assemblies.

## Adding a track

Open the Add track form from the menu bar to add a track or connection:

<Figure caption="JBrowse 2 file menu with the 'Add track' form" src="/img/add_track_form.png"/>

The action button (circular "+") inside the track selector opens the same form:

<Figure caption="The 'Add track' form can be launched from the circular '+' button in the bottom righthand corner" src="/img/add_track_tracklist.png"/>

In the "Add track" form, provide a URL or select a local file to load. For the
formats JBrowse supports and their accepted index types, see
[](/docs/config_guides/file_types). Plugins add support for further data
formats; see the [plugin store](/docs/user_guides/plugin_store).

### Editing a track

Open a Linear Genome View and click the "Select tracks" button. Each track's
three-dot (...) menu has a "Settings" button, which opens the configuration
editor. The editor live-edits any configurable value for that track, and changes
are persisted to the config file when editing through the admin-server.

## Setting a default session

The graphical admin server also sets the default session, the session that
appears when JBrowse 2 is first visited. Open the Set default session form
(Admin menu):

<Figure caption="The 'Set default session' will persist your current session into the config file so any subsequent visitors to the app will see this session." src="/img/default_session_form.png"/>

The form clears the default session, or sets it to the currently open session or
any previously saved one.

## See also

- [Quickstart web](/docs/quickstart_web)
- [](/docs/config_guides/file_types)
- [](/docs/config_guides/default_session)
- [Assembly configuration guide](/docs/config_guides/assemblies)
- [](/docs/config_guide)
