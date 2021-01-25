---
id: faq
title: FAQ
toplevel: true
---

### General

#### What technologies does JBrowse 2 use

- React
- mobx-state-tree
- web-workers
- Typescript
- Electron (for desktop specifically)

#### What is special about JBrowse 2

One thing that makes JBrowse 2 special is that we can create new view
types via our plugin system, e.g. circular, dotplot, etc. Anything you want can
be added as a view, and can be shown alongside our other views

This makes JBrowse 2 more than just a genome browser-- it is really a platform
that can be built on.

#### What are new features in jbrowse 2

- Uses webworkers for data parsing and rendering tracks
- Use ctrl+scroll to zoom in and out quickly
- Status updates while track is loading (e.g. Downloading BAM index...)
- Hi-C visualization from .hic format files
- Can display multiple chromosomes or discontinuous regions on a single linear
  genome view
- Can connect to UCSC trackhubs
- Alignments track has both coverage and pileup display integrated in a single track
- Read pileups can be sorted by various attributes
- Has ability to show soft clipped bases on reads
- Interactively edit the configuration using the GUI
- Circular, dotplot, stacked synteny views
- SV inspector, that gives tabular and circular overview of data in a single view
- Linear genome view can be reverse complemented

#### Can the linear genome view be reverse complemented

Yes! See [here](user_guide#navigating-the-ui)

### Setup

#### How can I start the JBrowse 2 app as a developer

We recommend that you have the following

- Node v10+
- Git
- [Yarn](https://classic.yarnpkg.com/en/docs/install/#debian-stable)

Then you can follow steps from our
[README](https://github.com/gmod/jbrowse-components)

It basically boils down to git cloning our repo, and running `yarn start` which
creates a development server on port 3000

You can use `PORT=8080 yarn start` to manually specify a different port

Note that this is a development server that gets started up. To install jbrowse
2 in production on your webserver, see below

#### Do you have any tips for learning React and mobx-state-tree

Here is a short guide to React and mobx-state-tree that could help get you oriented

https://gist.github.com/cmdcolin/94d1cbc285e6319cc3af4b9a8556f03f

#### How can I setup JBrowse 2 in production

We recommend following the steps in the [quickstart web](quickstart_web) guide.

The general procedure is using the `jbrowse create /var/www/html/jb2` and this
will download the latest version of jbrowse to your web folder e.g. in
/var/www/html

You can also use `jbrowse upgrade /var/www/html/jb2` to get the latest version

#### How can I setup JBrowse 2 without the CLI tools

The jbrowse CLI tools are basically a convenience, and are not strictly required

Simple tasks can be done without it

For example, for jbrowse create, you can visit the [blog](/jb2/blog) and
download the latest jbrowse-web release tag, and unzip it into your web
directory

For other things, like add-assembly and add-track, you can manually edit the
config.json, reviewing the config docs and sample configs will be valuable

Understanding the [config basics](config_guide#intro-to-the-configjson) will
come in handy also because you can manually edit in advanced configs after your
tracks are loaded however be careful because corrupt configs can produce hard
to understand errors, because our config system is strongly typed

Feel free to message the team if you encounter these

#### How do I load a track into JBrowse 2

If you have followed the above steps and installed jbrowse 2 on your webserver
and loaded the assembly, and have the CLI tools installed

    jbrowse add-track myfile.bw -a hg19

This will setup a bigwig track on the hg19 assembly in your config.json. Make
sure to run the command inside your current jbrowse2 folder e.g.
/var/www/html/jbrowse2 or wherever you are currently setting up a config.json
(you can have multiple configs)

Note that you can also use remote URLs

    jbrowse add-track http://yourremote/myfile.bam

The add-track command will do as much as possible to infer from the file
extension how to configure this track, and automatically infer the index to be
myfile.bam.bai

### Curiosities

#### Why do all the tracks need an assembly specified

We require that all tracks have a specific genome assembly specified in their
config. This is because jbrowse 2 is a multi-genome-assembly browser (and can
compare genomes given the data). This may be different to using say jbrowse 1
where it knows which genome assembly you are working with at any given time

#### How are the menus structured in the app

In JBrowse 1, the app level menu operated on the single linear genome view, but
with JBrowse 2, the top level menu only performs global operations and the
linear genome view has it's own hamburger menu. Note that each track also has
it's own track level menu.

#### Why do some of my reads not display soft clipping?

Some reads, such as secondary reads, do not have a SEQ field on their records,
so they will not display softclipping.

These reads will display their soft-clipping indicator as black
