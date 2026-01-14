Welcome, we are happy to receive contributions to jbrowse 2. This short guide
will help you get started

## TLDR

To quickly boot up the jbrowse-web app, run these commands

```
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
pnpm install
cd products/jbrowse-web
pnpm start
```

This will boot up a dev server of jbrowse-web, or web version of jbrowse 2

### Additional pre-requisites on certain versions of nodejs

The development environment sometimes can't install pre-built binaries of the
node-canvas dependency (used only for unit test), and therefore you will need to
download pre-requisites

To be clear, these dependencies are only needed for tests on certain platforms

On macOS with homebrew:

```
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

On Ubuntu, with apt:

```
sudo apt install -y python3 make gcc libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

```

After installing dependencies, if you still see errors about missing
`canvas.node`, you may need to rebuild the native module and reinstall:

```
pnpm rebuild canvas
pnpm install
```

## Windows git clone instructions

Our repository uses symlinks, so you need to use a specialized git clone
command:

```pwsh
# Make sure you check out line-endings as-is by running
# `git config --global core.autocrlf false`
# Also, make sure symlinks are enabled by running
# `git config --global core.symlinks true`.
# You may also need to clone as an administrator for symlinks to work.
git clone -c core.symlinks=true https://github.com/GMOD/jbrowse-components.git
cd .\jbrowse-components\
pnpm install
```

## Running jbrowse-web

```sh
cd products/jbrowse-web
pnpm start
```

## Running jbrowse-desktop

I recommend starting two different terminals, one that runs the webpack dev
server, one with the electron shell

```sh
# starts webpack dev server
cd products/jbrowse-desktop
pnpm start

# starts electron window
cd products/jbrowse-desktop
pnpm electron
```

## Running storybook

For running e.g. jbrowse-react-linear-genome-view you can use storybook

```sh
cd products/jbrowse-react-linear-genome-view
pnpm storybook
```

You can similarly run storybooks in the circular and react-app embedded
components

## Running eslint

```sh
pnpm lint # optionally with --fix
```

It is a fairly heavy lint process, so takes time

## Running typechecks

We also use typescript, and you can use this command in the repo root

```sh
pnpm tsc
```

Editing source code with your text editor should automatically pick up our
typescript integration

## Website documentation

We store all our website docs in the `website/` folder

To run the website

```
cd website
yarn
yarn start
```

You can edit the markdown by hand. The documentation is built into a website and
a PDF using latex here http://jbrowse.org/jb2/jbrowse2.pdf

### Adding images to the docs

Please use an image compressor such as pngquant before adding images to the
docs. For each image, please also specify a caption using text below the image
line in the markdown

```
![](yourfile.png)
Your caption of the image here
```

This creates a caption of the image properly in the PDF, and just shows the text
below the image on the website

## Monorepo code organization

JBrowse 2 code is organized as a monorepo using
[pnpm workspaces](https://pnpm.io/workspaces). Using a monorepo means that
instead of separate GitHub repositories for each piece of JBrowse, they are all
in a single place and can share code easily. In the top level of the repository
there are two directories, `packages/` and `products/` that each contain
multiple packages.

Each "package" is an npm-style (i.e. contains `package.json`) package. The
packages in `packages/` are core code, development tools, etc. The packages in
`plugins/` are JBrowse plugins. Most of JBrowse is written as plugins, so that
is where most of the code is. The packages in `products/` are user-facing
products, such as JBrowse Web, JBrowse Desktop, JBrowse CLI, etc.

### Monorepo packages

The following is a summary of some of the individual packages in the monorepo.
It's not a comprehensive list, but will hopefully help familiarize you with how
the code is organized.

#### products/jbrowse-web

This is the full JBrowse Web app. It is built using
[create-react-app](https://create-react-app.dev/).

It includes many other packages as core plugins, can load other plugins at
runtime, and more.

It also currently holds the "integration tests" that we use for our code in
`products/jbrowse-web/src/tests`.

#### products/jbrowse-desktop

JBrowse Desktop is our essentially the same as JBrowse Web, but packaged with
[electron](https://www.electronjs.org/) into a desktop app. This gives it the
ability to easily load and save tracks based on files on your local filesystem.
It also has save sessions locally, and works offline.

#### products/website

This provides the docusaurus website with docs, blog, and pdf documentation

#### plugins/alignments

This package provides the "alignments" related features including

- BamAdapter - our BAM parser that wraps @gmod/bam NPM module
- CramAdapter - our CRAM parser that wraps the @gmod/cram NPM module
- AlignmentsTrack - a "supertrack" which contains a PileupDisplay and
  SNPCoverageDisplay "subtracks"
- AlignmentsFeatureWidget for alignments features

#### plugins/variants/

Provides variant features including

- VCF tabix parser
- VCF non-tabix parser
- VariantFeatureWidget
- VariantTrack that is basically just a normal track, but has logic to popup the
  VariantFeatureWidget on feature click

#### plugins/hic

This provides a HicAdapter based on the .hic file format
([ref](https://github.com/aidenlab/juicer/wiki/Data#hic-files))

Also a track type and renderer to visualize these

#### plugins/bed

Provides two bed related data adapters

- BigBedAdapter
- BedTabixAdapter

These can be used with the SvgFeatureRenderer

#### plugins/wiggle

Provides wiggle track types with different types of rendering formats including

- XYPlotRenderer
- LinePlotRenderer
- DensityRenderer

The WiggleTrack type can swap out these different rendering types, and
calculates stats such as max and min score over a region before the region is
rendered

#### plugins/svg

This is the main gene glyphs, which are rendered using SVG

General usage of this involves referencing the SvgFeatureRenderer

#### plugins/spreadsheet-view

This provides a spreadsheet-in-the-browser that can be used as a data backend to
power other views

#### plugins/circular-view

This provides our 'Circos-style' whole-genome overview of data, especially
genomic translocations

#### plugins/sv-inspector

This is a "superview" type that contains a circular and spreadsheet view as
child views

## Internal plugin build system

Plugins may be built as separate packages that can be distributed on NPM. In
order to streamline development and avoid having to build every plugin before
developing on e.g. JBrowse Web, however, the `package.json`'s "main" entry for
plugins in this monorepo by default points to the un-built code (e.g.
`src/index.ts`). JBrowse Web then takes care of building the plugins itself (see
`products/jbrowse-web/rescripts/yarnWorkspacesRescript.js`).

When publishing to NPM, pnpm's `publishConfig` feature automatically overrides
the `main` and `module` fields to point to the built output (e.g.
`dist/index.js`). This means no manual switching between source and dist is
needed.

## Preparing sample data sets

We have a number of sample datasets in our test_data folder

### Text indexes

The hg19 and hg38 text indexes were generated as follows for config_demo

```

jbrowse text-index --tracks ncbi_refseq_109_hg38_latest  --out config_demo.json --force --attributes Name,ID,Note,description,gene_synonym


jbrowse text-index -a hg19 --tracks ncbi_gff_hg19 --out config_demo.json --force --attributes Name,ID,Note,description,gene_synonym

```

## Notes about monorepo setup

Our setup for the monorepo takes notes from the material-ui repository. Some
particular notes include

1. The use of the "flat" packages/core package, where you can import from nested
   subpaths like '@jbrowse/core/util'
2. The use of tsconfig.build.json to generate types in the final release
3. The use of referring to the src directory at development time

## What to do if a release fails

### Option A. It already published to NPM

You should probably run another patch release

Note: You must make miniscule source code change or the changelog code will
fail, so rename a random variable somewhere, commit, and re-run the release

### Option B. It hasn't published to NPM

You can cancel the release script

If it already pushed the tag, then revert the automated commits it made, and
then delete the tag and push the tag delete (e.g. git tag -d v1.2.3 && git push
origin :refs/tags/v1.2.3)

If it already made a release draft, delete it, and then re-run the release
script
