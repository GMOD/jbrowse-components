---
id: faq
title: FAQ
toplevel: true
---

### General

#### What is special about JBrowse 2

One thing that makes JBrowse 2 special is that we can create new view types via
our plugin system, e.g. circular, dotplot, etc. Anything you want can be added
as a view, and can be shown alongside our other views

This makes JBrowse 2 more than just a genome browser-- it is really a platform
that can be built on.

#### What are new features in JBrowse 2

See the https://jbrowse.org/jb2/features page for an overview of features

### Setup

#### What web server do I need to run JBrowse 2

JBrowse 2 by itself is just a set of JS, CSS, and HTML files that can be
statically hosted on a webserver without any backend services running.

Therefore, running JBrowse 2 generally involves just copying the JBrowse 2
folder to your web server html folder e.g. `/var/www/html/`.

If you use a different platform such as Django, you may want to put it in the
static resources folder.

Note that the server that you use should support byte-range requests (e.g. the
[Range HTTP
header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range) so
that JBrowse can get small slices of large binary data files.

#### BAM files do not work on my server

If you are using Apache then you will probably want to disable mime_magic. If
mime_magic is enabled, you may see that your server responds with the HTTP
header Content-Encoding: gzip which JBrowse does NOT want, because this
instructs the browser to unzip the data but JBrowse should be in charge of
this.

#### How can I setup JBrowse 2 on my web server

We recommend following the steps in the [quickstart web](../quickstart_web) guide.

The general procedure is using the `jbrowse create /var/www/html/jb2` and this
will download the latest version of jbrowse to your web folder e.g. in
/var/www/html

You can also use `jbrowse upgrade /var/www/html/jb2` to get the latest version

#### How do I install or update the @jbrowse/cli tool

To install the @jbrowse/cli tool, you can use `npm install -g @jbrowse/cli`

You can use this same command to upgrade the tool too

This command will give you a command named `jbrowse` which should automatically
be in your path if you have a standard installation of nodejs. We recommend
using nodesource or nvm to get your nodejs for this.

Also note that the @jbrowse/cli tool is just made for preparing your
config.json, it is not used to run any server-side code

#### How do I update my instance of jbrowse-web

You can use the command, after installing

```
jbrowse upgrade /path/to/your/jbrowse2
```

This will download the latest release from github and overwrite it onto your
jbrowse-web instance

#### How can I setup JBrowse 2 without the CLI tools

The jbrowse CLI tools are basically a convenience, and are not strictly required

Simple tasks can be done without it

For example, for jbrowse create, you can visit the [blog](/jb2/blog) and
download the latest jbrowse-web release tag, and unzip it into your web
directory

For other things, like add-assembly and add-track, you can manually edit the
config.json, reviewing the config docs and sample configs will be valuable

Understanding the [config basics](../config_guide#intro-to-the-configjson) will
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

#### Why do some of my reads not display soft clipping

Some reads, such as secondary reads, do not have a SEQ field on their records,
so they will not display softclipping.

The soft clipping indicators on these reads will appear black.

#### How does JBrowse know when to display the "Zoom in to see more features" message

The rules that JBrowse uses to determine when to display the "Zoom in to see more features" message are called stats estimation rules

The general outline is:

- It doesn't display a zoom in message if zoomed in closer than 20kb
- It performs byte size estimation for BAM and CRAM type files (you will see a
  byte size estimation displayed alongside the "Zoom in to see features"
  message
- Other data types that don't use byte size estimation use feature density
  based calculation
- Hi-C, BigWig, and sequence adapters are hardcoded to return `{ featureDensity:0 }` to always render

If you need to customize your particular track, you can set config variables on
the "display" section of your config

- `maxFeatureScreenDensity` - number of features times bpPerPx
- `fetchSizeLimit` - this config variable exists on the adapters (can increase size limit)

Example config with a small feature screen density

```json
{
  "type": "VariantTrack",
  "trackId": "variant_density",
  "name": "test variants (small featuredensity limit)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "volvox.filtered.vcf.gz"
    },
    "index": {
      "location": {
        "uri": "volvox.filtered.vcf.gz.tbi"
      }
    }
  },
  "displays": [
    {
      "type": "LinearVariantDisplay",
      "maxFeatureScreenDensity": 0.0006,
      "displayId": "volvox_filtered_vcf_color-LinearVariantDisplay"
    }
  ]
}
```

Example config for a CRAM file with a small fetchSizeLimit configured

```json
{
  "type": "AlignmentsTrack",
  "trackId": "volvox_cram",
  "name": "test track (small fetch size limit)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "CramAdapter",
    "cramLocation": {
      "uri": "volvox-sorted-altname.cram"
    },
    "craiLocation": {
      "uri": "volvox-sorted-altname.cram.crai"
    },
    "sequenceAdapter": {
      "type": "TwoBitAdapter",
      "twoBitLocation": {
        "uri": "volvox.2bit"
      }
    },
    "fetchSizeLimit": 1000
  }
}
```

### Text searching

#### Why I am running out of disk space while trix is running

The `jbrowse text-index` program will output data to a TMP directory while
indexing. If your filesystem has low diskspace for /tmp you can set an
alternative temporary directory using the environment variable
`TMPDIR=~/alt_tmp_dir/ jbrowse text-index`.

#### How does the jbrowse text-index trix format work

The `jbrowse text-index` command creates text searching indexes using trix. The
trix indexes are based on the format described by UCSC here
https://genome.ucsc.edu/goldenPath/help/trix.html but we reimplemented the code
the create these index formats in the JBrowse CLI so you do not have to install
the UCSC tools.

The main idea is that you give trix

```
GENEID001  Wnt signalling
GENEID002  ey  Pax6
```

Then this will generate a new file, the .ix file, sorted in alphabetical order

```
ey  GENE002
signalling  GENE001
Pax6  GENE002
Wnt  GENE001
```

Then a second file, the .ixx file, tells us at what byte offset certain lines
in the file are e.g.

```
signa000000435
```

Note that JBrowse creates a specialized trix index also. Instead of creating a
ix file with just the gene names, it also provides their name and location in
an encoded format.

### Developers

#### How can I start the JBrowse 2 app as a developer

We recommend that you have the following

- Node v12+
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

#### What technologies does JBrowse 2 use

We build on a lot of great open source technology, some main ones include

- React
- mobx-state-tree
- web-workers
- Typescript
- Electron (for desktop specifically)

#### Should I configure gzip on my web server

Yes! JBrowse 2 may load ~5MB of JS resources (2.5MB for main thread bundle,
2.5MB for worker bundle). If you have gzip enabled, the amount of data the user
has to download though is only 1.4MB. We have worked on making bundle size
small with lazy loading and other methods but adding gzip will help your users.

It will depend on your particular server setup e.g. apache, nginx, cloudfront,
etc. how this may be done, but it is recommended to look into this.

#### Why can't I copy and paste my URL bar to share it with another user

In JBrowse Web, the current session can become too long to store in the URL
bar, so instead, we store it in localStorage and only keep the key to the
localStorage entry in the URL var. This is because otherwise URLs can get
prohibitively long, and break server side navigations, intermediate caches,
etc. Therefore, we make "sharing a session" a manual step that generates a
shortened URL by default

Note 1: user's of @jbrowse/react-linear-genome-view have to re-implement any
URL query param logic themselves, as this component makes no attempt to access
URL query params

Note 2: You can copy and paste your URL bar and put it in another tab on your
own computer, and JBrowse will restore the session using BroadcastChannel
(supported on Firefox and Chrome)

#### How does the session sharing with shortened URLs work in JBrowse Web

We have a central database hosted as a AWS dynamoDB that stores encrypted
session snapshots that users create when they use the "Share" button. The
"Share" button creates a random key on the client side (which becomes the
&password= component of the share URL), encrypts the session client side, and
sends the encrypted session without the key to the AWS dynamoDB.

This process, generates a URL with the format

&session=share-&lt;DYNAMODBID&gt;&password=&lt;DECODEKEY&gt;

The DECODEKEY is never transmitted to the server, but you can copy and paste
the share URL, the person you shared automatically downloads the DynamoDB
entry, and decodes it with the DECODEKEY from the URL that you provide

With this system, the contents of the dynamoDB are safe and unable to be read,
even by JBrowse administrators.

#### What should I do if the Share system isn't working?

If for any reason the session sharing system isn't working, e.g. you are behind
a firewall or you are not able to connect to the central share server, you can
click the "Gear" icon in the "Share" button pop-up, and it will give you the
option to use "Long URL" instead of "Short URL" which let's you create share
links without the central server

Also, if you are implementing JBrowse Web on your own server and would like to
create your own URL shortener, you can use the shareURL parameter in the
config.json file to point at your own server instead of ours.

### Troubleshooting

Doing things like:

- Changing trackIds
- Deleting tracks

Can make user's saved sessions fail to load. If part of a session is
inconsistent, currently, the entire session will fail to load. Therefore, make
decisions to delete or change IDs carefully.
