Welcome, we are happy to receive contributions to jbrowse 2. This short guide
will help you get started

## Source editing

The TLDR of getting started with the app is using

```
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
yarn
cd products/jbrowse-web
yarn start
```

This will boot up a dev server of jbrowse-web, or web version of jbrowse 2

To get orientated with the source code, please see
https://jbrowse.org/jb2/docs/developer_guide

As far as helpful tips, we suggest having lint-on-save configured for your
source code editor, so that prettier and eslint fix simple issues in formatting

You can also run lint from the command line from the repo root

    yarn lint # optionally with --fix

We also use typescript, and you can use this command in the repo root

    yarn tsc

## Documentation

We store all our docs in the `website/` folder

To run the website

```
cd website
yarn
yarn start
```

You can edit the markdown by hand. The documentation is built into a website
and a PDF using latex here http://jbrowse.org/jb2/jbrowse2.pdf

### Adding images to the docs

Please use an image compressor such as pngquant before adding images to the
docs. For each image, please also specify a caption using text below the image
line in the markdown

```
![](yourfile.png)
Your caption of the image here
```

This creates a caption of the image properly in the PDF, and just shows the
text below the image on the website

## Developers

### Releasing/publishing

There is a script `scripts/release.sh` that will publish the public packages in
the monorepo to NPM and trigger the creation of a release on GitHub. To run this
script:

- Ensure that there is an announcement file for this release in
  `website/release_announcement_drafts/<tag>.md` containing a an overview of the
  major features and bugfixes in the release, with as many nice screenshots or
  movies as possible. The release script will automatically add download and
  detailed changelog information to this post. You can see examples of the
  finished posts at https://jbrowse.org/jb2/blog. If you want to preview the
  changelog to help write the release announcement, you can use the command
  `GITHUB_AUTH=<auth_token> yarn --silent lerna-changelog > tmp_changelog.md`
  (make sure to run the command on the main branch). See the next step if you
  need to generate an access token.

- Make sure you have a GitHub access token with public_repo scope. To generate
  one, go to https://github.com/settings/tokens, click "Generate new token,"
  add a note describing what you want the token to be for, select the
  "public_repo" checkbox (under "repo"), and then click "Generate token." Make
  sure to save this token in a safe place to use for future releases as you
  won't be able to see it again. If you do lose your token, delete/revoke the
  token you lost and generate a new one.

- Decide if the release should have a major, minor, or patch level version
  increase. All packages that are published will get the same version number.

Run the script like this:

```
scripts/release.sh myGitHubAuthToken versionIncreaseLevel
```

If you don't provide `versionIncreaseLevel`, it will default to "patch".

This will trigger a GitHub workflow that will build JBrowse Web and create a
draft release on GitHub. Once the draft release has been created (you can look
for it [here](https://github.com/GMOD/jbrowse-components/releases)), go to the
release and click "Edit," then add a description to the release. Usually you
can copy the content of the blog post that was generated (it will be named
something like `website/blog/${DATE}-${RELEASE_TAG}-release.md`), removing the
"Downloads" section. Finally, click "Publish release."

## Monorepo code organization

JBrowse 2 code is organized as a monorepo using [lerna](https://lerna.js.org/)
and [yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/). Using a
monorepo means that instead of separate GitHub repositories for each piece of
JBrowse, they are all in a single place and can share code easily. In the top
level of the repository there are two directories, `packages/` and `products/`
that each contain multiple packages.

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
- PileupTrack type - draws alignments as boxes in a "pileup" style view
- SNPCoverageTrack - draws calculated coverage with mismatches drawn over the coverage
- AlignmentsTrack - a "supertrack" which contains a PileupTrack and
  SNPCoverageTrack "subtracks"
- AlignmentsFeatureWidget for alignments features

#### plugins/variants/

Provides variant features including

- VCF tabix parser
- VariantFeatureWidget
- VariantTrack that is basically just a normal track, but has logic to popup
  the VariantFeatureWidget on feature click

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

This provides a spreadsheet-in-the-browser that can be used as a data backend
to power other views

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

When you want to use a built plugin, you can run `yarn useDist` in the plugin's
`package.json`, and then run `yarn useSrc` to restore it when you're done. As an
example, the root-level `yarn build` that builds all the packages does this to
build all the plugins and then build JBrowse Web and JBrowse Desktop using the
built plugins.
