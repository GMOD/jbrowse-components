---
id: bcc2020_embedding_jbrowse_04_assemblies
title: About assemblies
---

:::danger

Out of date Please see the
[updated version of this tutorial](/docs/tutorials/embed_linear_genome_view/01_introduction)

:::

## What is an assembly?

An assembly in JBrowse 2 is a collection of information that describes the
organism you are working with, such as its name and its reference sequence. This
is what JBrowse 2 uses to set up the coordinate system for the genome browser
and keep tracks organized. In JBrowse Web, you are able to have multiple
assemblies on screen at the same time. JBrowse Linear View, however, is more
focused and allows just one assembly.

These are the options you can specify for an assembly:

- **Name** - The name of your assembly, often something like "GRCh38," "hg19,"
  or "mm10".
- **Aliases** - Potential aliases for your assembly, such as "hg38" being an
  alias for "GRCh38".
- **Reference Sequence** - The file that has the genome sequence for your
  organism. JBrowse natively supports indexed FASTA (compressed or not), 2BIT,
  and chrom.sizes sequence files.
- **Reference Sequence Name Aliases** - You can define aliases for the names in
  your reference sequence file, so if for example your reference sequence uses
  "chr1", you can add an alias for it so that data file that use "1" instead
  will still display correctly.
- **Colors** - You can define a list of colors that will be used to color the
  reference sequences. If you supply fewer colors than reference sequences,
  JBrowse will cycle through them. By default JBrowse will use its built-in
  color scheme of 26 colors based on the UCSC Genome Browser color scheme.

## Adding an assembly

An assembly definition is a JSON object that describes the assembly. You can
create them by hand, but we're still working on a good way to document all of
the possible options. There is a way to generate these via a command-line
interface (CLi), so we'll use that to generate our assembly.

### Installing JBrowse-CLI

The JBrowse 2 CLI is designed to set up a configuration file for JBrowse Web,
but since JBrowse Linear View is based on the same code, we can use it to
generate what we need as well.

We'll use `yarn` on the VM to install the CLI. `yarn` is an alternative to `npm`
that has some nicer ways to handle global package installations. To install the
CLI, open a terminal and run the following commands:

```sh
yarn global add @jbrowse/cli
echo export PATH="$(yarn global bin):$PATH" >> ~/.bashrc
source ~/.bashrc
```

Now if you run the command `jbrowse --help` in the terminal, you should see
something like this:

![The output of `jbrowse --help` in a terminal](/img/bcc2020_jbrowse_help.png)

:::note

If you're not using the VM You may already have `yarn` or `npm` set up to do
global installations, so you might be able to skip the part about adding the
`yarn global bin` location to your `PATH`.

If you don't want to install the CLI and you have NPM installed, you can also do
all of the things we will do in this tutorial by replacing `jbrowse` in any
commands with `npx @jbrowse/cli`. For example, to get the help output you would
run

```sh
npx @jbrowse/cli --help
```

:::

### Preparing the files

Let's use a human GRCh38 assembly as our example. First we need a sequence file.
Ensembl hosts a compressed indexed FASTA that we can use. The URL is
http://ftp.ensembl.org/pub/release-100/fasta/homo_sapiens/dna_index/Homo_sapiens.GRCh38.dna.toplevel.fa.gz.

We also need to define some reference sequence name aliases so that any files we
want to use that use "chr1" instead of "1" will display correctly. In VS Code,
create a new file called "GRCh38.aliases.txt" in the same location as
"index.html" and paste into it the data found on
[this page](../bcc2020_embedding_jbrowse_aliases).

This aliases file has on each line a name from the reference sequence and then a
tab-separated list of aliases for that name.

### Running the `jbrowse` command

We can create a JBrowse CLI to create a JBrowse Web config file, which we can
use to get the assembly for JBrowse Linear View. We create a config file with an
assembly (or add an assembly to an existing config file) with the
`jbrowse add-assembly` command. You can run `jbrowse add-assembly --help` to see
all the options. We'll run it as below:

```sh
cd ~/html
jbrowse add-assembly http://ftp.ensembl.org/pub/release-100/fasta/homo_sapiens/dna_index/Homo_sapiens.GRCh38.dna.toplevel.fa.gz --name GRCh38 --alias hg38 --refNameAliases GRCh38.aliases.txt --skipCheck
```

This will create a file called "config.json". Go ahead and open that file up. In
it, you will see an entry called "assemblies". The first (and only) entry in
that list is our assembly. You can see the name, alias, sequence, and reference
name aliases we specified in our command. If for some reason the index files
were unusually named, you could change them in the "faiLocation" and
"gziLocation" entries, but these look right. Create a new file called
"assembly.js" and have it export this object, like this:

```javascript title="assembly.js"
export default {
  name: 'GRCh38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      fastaLocation: {
        uri: 'http://ftp.ensembl.org/pub/release-100/fasta/homo_sapiens/dna_index/Homo_sapiens.GRCh38.dna.toplevel.fa.gz',
        locationType: 'UriLocation',
      },
      faiLocation: {
        uri: 'http://ftp.ensembl.org/pub/release-100/fasta/homo_sapiens/dna_index/Homo_sapiens.GRCh38.dna.toplevel.fa.gz.fai',
        locationType: 'UriLocation',
      },
      gziLocation: {
        uri: 'http://ftp.ensembl.org/pub/release-100/fasta/homo_sapiens/dna_index/Homo_sapiens.GRCh38.dna.toplevel.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    },
  },
  aliases: ['hg38'],
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      location: {
        uri: 'GRCh38.aliases.txt',
        locationType: 'UriLocation',
      },
    },
  },
}
```

Then add an import to your "index.html" adding this data:

```html {9-11} title="index.html"
<html>
  <head>
    <script src="//s3.amazonaws.com/jbrowse.org/jb2_releases/jbrowse-linear-view/jbrowse-linear-view@v0.0.1-beta.0/umd/jbrowse-linear-view.js"></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear View!</h1>
    <div id="jbrowse_linear_view"></div>
    <script type="module">
      import assembly from './assembly.js'
    </script>
  </body>
</html>
```
