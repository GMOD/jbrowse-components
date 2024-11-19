yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.17.0

## 2.17.0 (2024-11-18)

#### :rocket: Enhancement

- `core`
  - [#4662](https://github.com/GMOD/jbrowse-components/pull/4662) Add better
    handling for bedMethyl files ([@cmdcolin](https://github.com/cmdcolin))
  - [#4652](https://github.com/GMOD/jbrowse-components/pull/4652) Reduce
    re-rendering on quantitative and snpcoverage track height adjustments
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4651](https://github.com/GMOD/jbrowse-components/pull/4651) Add mismatches
    cache to improve performance on ultra-long reads
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4649](https://github.com/GMOD/jbrowse-components/pull/4649) Add support
    for displaying SNPs in "no_ref" CRAM files
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4627](https://github.com/GMOD/jbrowse-components/pull/4627) Create BLAST
    tabular adapter ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#4647](https://github.com/GMOD/jbrowse-components/pull/4647) Improved
    rendering of modifications ([@cmdcolin](https://github.com/cmdcolin))
  - [#4646](https://github.com/GMOD/jbrowse-components/pull/4646) Fix mouseover
    pixelation on linear synteny view ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4639](https://github.com/GMOD/jbrowse-components/pull/4639) Fix RNA-seq
    stranded arc coloring, change the color of RNA-seq introns, and improve
    compact rendering ([@cmdcolin](https://github.com/cmdcolin))
  - [#4638](https://github.com/GMOD/jbrowse-components/pull/4638) Fix rendering
    of UCSC repeatmasker BigBed and BED files
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#4648](https://github.com/GMOD/jbrowse-components/pull/4648) Run codemod
    fix for some MUI deprecated props ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens)) Done
  in 1.81s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.16.1

## 2.16.1 (2024-11-03)

#### :rocket: Enhancement

- `app-core`, `core`, `product-core`, `text-indexing`
  - [#4624](https://github.com/GMOD/jbrowse-components/pull/4624) Add utility
    links to synteny feature details to allow centering a view on a feature
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4628](https://github.com/GMOD/jbrowse-components/pull/4628) Allow
    configuring Hi-C normalization and default resolution multiplier
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4619](https://github.com/GMOD/jbrowse-components/pull/4619) Add
    resolutionMultiplier config slot to BigWigAdapter
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#4634](https://github.com/GMOD/jbrowse-components/pull/4634) Fix opening
  local files in the multi-wiggle add track selector
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4633](https://github.com/GMOD/jbrowse-components/pull/4633) Fix "Add track"
  select box not going away after selecting element
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4632](https://github.com/GMOD/jbrowse-components/pull/4632) Standardize
  modification colors between alignments track coverage and pileup subtracks
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4631](https://github.com/GMOD/jbrowse-components/pull/4631) Fix config
  description of assembly name ordering for synteny data adapters
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4630](https://github.com/GMOD/jbrowse-components/pull/4630) Fix MM tag
  modifications from particular BAM file failing to render on the negative
  strand ([@cmdcolin](https://github.com/cmdcolin))
- [#4626](https://github.com/GMOD/jbrowse-components/pull/4626) Fix dark redraw
  on selected features after vertical resize of the synteny canvas
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.20s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.16.0

## 2.16.0 (2024-10-23)

#### :rocket: Enhancement

- Other
  - [#4615](https://github.com/GMOD/jbrowse-components/pull/4615) Add
    configuration of transcriptTypes and containerTypes to the svg feature
    rendering ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`
  - [#4430](https://github.com/GMOD/jbrowse-components/pull/4430) Multi-level
    synteny rendering ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#4593](https://github.com/GMOD/jbrowse-components/pull/4593) Fix navigating
    to a refname result that is also indexed in search track index
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4612](https://github.com/GMOD/jbrowse-components/pull/4612) Fix error with
    tooltips in embedded components in vite dev mode
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4602](https://github.com/GMOD/jbrowse-components/pull/4602) Fix decoding
    of CRAM ML tag ([@cmdcolin](https://github.com/cmdcolin))
  - [#4594](https://github.com/GMOD/jbrowse-components/pull/4594) Fix highlight
    button causing issues clicking underlying track features
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4586](https://github.com/GMOD/jbrowse-components/pull/4586) Update
    electron-builder to fix broken desktop builds
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4600](https://github.com/GMOD/jbrowse-components/pull/4600) Fix check for
    "hasSubSubfeatures" in svg feature rendering
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4590](https://github.com/GMOD/jbrowse-components/pull/4590) Fix opening
    .jbrowse files on desktop ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#4607](https://github.com/GMOD/jbrowse-components/pull/4607) Add tiberius
  sample dataset and updated gencode and ncbi GFF gene sets
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#4607](https://github.com/GMOD/jbrowse-components/pull/4607) Add tiberius
    sample dataset and updated gencode and ncbi GFF gene sets
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `embedded-core`, `product-core`, `web-core`
  - [#4606](https://github.com/GMOD/jbrowse-components/pull/4606) Remove
    react-error-boundary ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.02s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.15.4

## 2.15.4 (2024-09-20)

#### :bug: Bug Fix

- Other
  - [#4582](https://github.com/GMOD/jbrowse-components/pull/4582) Fix text
    indexing on Windows ([@cmdcolin](https://github.com/cmdcolin))
- `text-indexing`
  - [#4580](https://github.com/GMOD/jbrowse-components/pull/4580) Fix indexing
    plaintext gff/vcf on desktop ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.22s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.15.3

Done in 0.57s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.15.2

## 2.15.2 (2024-09-18)

#### :rocket: Enhancement

- [#4573](https://github.com/GMOD/jbrowse-components/pull/4573) Add pif.gz
  option to synteny import form ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#4571](https://github.com/GMOD/jbrowse-components/pull/4571) Fix code signing
  on the windows for jbrowse desktop ([@cmdcolin](https://github.com/cmdcolin))
- [#4566](https://github.com/GMOD/jbrowse-components/pull/4566) Fix handling of
  "." in VCF ALT field ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#4569](https://github.com/GMOD/jbrowse-components/pull/4569) Refactor GFF3
  parser to avoid returning internal \_linehash variable
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.30s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.15.1

## 2.15.1 (2024-09-12)

#### :rocket: Enhancement

- `core`, `sv-core`
  - [#4561](https://github.com/GMOD/jbrowse-components/pull/4561) Create notion
    of launching a single-row breakpoint split view
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4556](https://github.com/GMOD/jbrowse-components/pull/4556) Add dropdown
    menu from bookmark label clicks ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4554](https://github.com/GMOD/jbrowse-components/pull/4554) Fix the
    ability to sort menu items by priority for CascadingMenu
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#4560](https://github.com/GMOD/jbrowse-components/pull/4560) Fix coloring
    on circular chord renderings ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4553](https://github.com/GMOD/jbrowse-components/pull/4553) Fix
    performance regression since v2.14.0 in assembly loading
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#4548](https://github.com/GMOD/jbrowse-components/pull/4548) Create
    BaseTooltip component in @jbrowse/core/ui
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4547](https://github.com/GMOD/jbrowse-components/pull/4547) Avoid stream
    polyfill for GFF3/GTF parsing ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.16s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.15.0

Done in 1.26s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.14.0

## 2.14.0 (2024-08-28)

#### :rocket: Enhancement

- `core`
  - [#4532](https://github.com/GMOD/jbrowse-components/pull/4532) De-duplicate
    snackbar messages ([@cmdcolin](https://github.com/cmdcolin))
  - [#4516](https://github.com/GMOD/jbrowse-components/pull/4516) Add NCBI
    sequence_report.tsv alias adapter, with ability to recode NCBI fasta files
    to use UCSC style names ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4533](https://github.com/GMOD/jbrowse-components/pull/4533) Allow setting
    sequenceType='pep' in ReferenceSequenceTrack configuration
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4531](https://github.com/GMOD/jbrowse-components/pull/4531) Add
    UnindexedFastaAdapter for fetching small plaintext FASTA files
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4528](https://github.com/GMOD/jbrowse-components/pull/4528) Add
    description config slot to reference sequence track
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`
  - [#4523](https://github.com/GMOD/jbrowse-components/pull/4523) Allow
    plaintext GTF and VCF files greater than 512Mb
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`
  - [#4519](https://github.com/GMOD/jbrowse-components/pull/4519) Add "Group by"
    method for alignments tracks ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#4535](https://github.com/GMOD/jbrowse-components/pull/4535) Fix crash after
  navToLocString in some cases ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#4530](https://github.com/GMOD/jbrowse-components/pull/4530) Consolidate
    gff3 adapter featureData routine, avoid Number-ifying null phase
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4518](https://github.com/GMOD/jbrowse-components/pull/4518) Don't send
    displayModel to "rendering" components on server side
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `app-core`, `core`, `embedded-core`, `product-core`,
  `text-indexing`, `web-core`
  - [#4513](https://github.com/GMOD/jbrowse-components/pull/4513) Add new eslint
    rules (no-unnecessary-condition, no-unused-expressions, etc) and tsconfig
    noUncheckedIndexedAccess ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `embedded-core`, `product-core`, `text-indexing`,
  `web-core`
  - [#4510](https://github.com/GMOD/jbrowse-components/pull/4510) Add biome lint
    fixes ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`, `text-indexing`
  - [#4508](https://github.com/GMOD/jbrowse-components/pull/4508) Use
    @mui/x-charts-vendor for d3 upgrade
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens)) Done
  in 1.30s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.13.1

## 2.13.1 (2024-07-31)

#### :rocket: Enhancement

- [#4497](https://github.com/GMOD/jbrowse-components/pull/4497) Add ability to
  toggle "Show track outlines" ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#4501](https://github.com/GMOD/jbrowse-components/pull/4501) Fix opening
  track selector in linear synteny view causing crash in v2.13.0
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4495](https://github.com/GMOD/jbrowse-components/pull/4495) Fix log scale
  for some types of signal tracks ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.30s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.13.0

## 2.13.0 (2024-07-25)

#### :rocket: Enhancement

- [#4494](https://github.com/GMOD/jbrowse-components/pull/4494) Add assembly
  name to scalebar in synteny views ([@cmdcolin](https://github.com/cmdcolin))
- [#4480](https://github.com/GMOD/jbrowse-components/pull/4480) Changes default
  height for SVG rendering to maxHeight to fix blank track effect on slow CPU
  ([@carolinebridge](https://github.com/carolinebridge))
- [#4478](https://github.com/GMOD/jbrowse-components/pull/4478) Add ability to
  use CSI indexes in @jbrowse/img ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#4483](https://github.com/GMOD/jbrowse-components/pull/4483) Fix
    configuration settings for track sorting in the track selector
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4476](https://github.com/GMOD/jbrowse-components/pull/4476) Fix config
    editor crash in vite usage of embedded components in dev mode
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4473](https://github.com/GMOD/jbrowse-components/pull/4473) Fix 'Show no
    tracks active button' checkbox not working
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- `core`
  - [#4481](https://github.com/GMOD/jbrowse-components/pull/4481) Add SARS-CoV2
    demo to test_data ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4487](https://github.com/GMOD/jbrowse-components/pull/4487) Update faq.md
    with compression explanation
    ([@Maarten-vd-Sande](https://github.com/Maarten-vd-Sande))

#### :house: Internal

- `core`
  - [#4493](https://github.com/GMOD/jbrowse-components/pull/4493) Remove
    prop-types from re-exports ([@cmdcolin](https://github.com/cmdcolin))
  - [#4492](https://github.com/GMOD/jbrowse-components/pull/4492) Change
    abortable-promise-cache to @gmod/abortable-promise-cache
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4488](https://github.com/GMOD/jbrowse-components/pull/4488) Fix autogen
    docs build ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Caroline Bridge ([@carolinebridge](https://github.com/carolinebridge))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- [@Maarten-vd-Sande](https://github.com/Maarten-vd-Sande) Done in 1.66s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.12.3

## 2.12.3 (2024-06-27)

#### :rocket: Enhancement

- [#4465](https://github.com/GMOD/jbrowse-components/pull/4465) Add `contig` to
  the default dontRedispatch list for Gff3TabixAdapter
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4464](https://github.com/GMOD/jbrowse-components/pull/4464) Bump
  generic-filehandle to put URL in error messages
  ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#4469](https://github.com/GMOD/jbrowse-components/pull/4469) Fix error
  launching session on desktop in v2.12.2
  ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#4466](https://github.com/GMOD/jbrowse-components/pull/4466) Add demo of
  using farm-fe bundler for embedded components
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.30s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.12.2

Done in 0.74s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.12.1

Done in 0.81s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.12.0

## 2.12.0 (2024-06-20)

#### :rocket: Enhancement

- Other
  - [#4459](https://github.com/GMOD/jbrowse-components/pull/4459) Allow using
    keyboard shortcut for devtools in production desktop builds
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4455](https://github.com/GMOD/jbrowse-components/pull/4455) Add slot.type
    to configuration editor elements ([@cmdcolin](https://github.com/cmdcolin))
  - [#4427](https://github.com/GMOD/jbrowse-components/pull/4427) Add ctrl+wheel
    scroll to zoom both top and bottom of synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4425](https://github.com/GMOD/jbrowse-components/pull/4425) Add ability to
    dismiss dotplot warnings ([@cmdcolin](https://github.com/cmdcolin))
  - [#4422](https://github.com/GMOD/jbrowse-components/pull/4422) Make initial
    linear synteny view import form submit show all regions by default
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4456](https://github.com/GMOD/jbrowse-components/pull/4456) Add
    aggregation to BigBedAdapter to group bigGenePred transcripts
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4448](https://github.com/GMOD/jbrowse-components/pull/4448) Adds genomic
    coordinates back into the sequence panel accounting for strand direction
    ([@carolinebridge](https://github.com/carolinebridge))
  - [#4423](https://github.com/GMOD/jbrowse-components/pull/4423) Speed up large
    displayedRegions sets by converting MST array of Region[] into a
    types.frozen<IRegion[]> ([@cmdcolin](https://github.com/cmdcolin))
  - [#4399](https://github.com/GMOD/jbrowse-components/pull/4399) Allow viewing
    coordinates in sequence feature display panel
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`
  - [#4443](https://github.com/GMOD/jbrowse-components/pull/4443) Allow drawer
    widget to be "popped out" into a dialog box
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`
  - [#3992](https://github.com/GMOD/jbrowse-components/pull/3992) Add ability to
    get refNames for a track in the "About track" panel
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#4458](https://github.com/GMOD/jbrowse-components/pull/4458) Fix sandbox
    error on AppImage startup on certain linux systems
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4441](https://github.com/GMOD/jbrowse-components/pull/4441) Fix sorting
    data grid on multi-wiggle 'Edit colors/arrangement' dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4439](https://github.com/GMOD/jbrowse-components/pull/4439) Fix blank
    lines in multi-wiggle add track workflow causing crash
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4438](https://github.com/GMOD/jbrowse-components/pull/4438) Fix
    cursor:pointer style on an alignments feature detail clickable link
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4436](https://github.com/GMOD/jbrowse-components/pull/4436) Fix "Open
    synteny view at this position" when file contains CIGAR X/= operators
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4426](https://github.com/GMOD/jbrowse-components/pull/4426) Fix side
    scroll in linear synteny view causing the browser "back" action
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4417](https://github.com/GMOD/jbrowse-components/pull/4417) Fix error
    message shown on chromosomes with missing data for plaintext GFF3
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4442](https://github.com/GMOD/jbrowse-components/pull/4442) Fix unstable
    dialog width in "About track" dialog for multi-quantitative tracks
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#4445](https://github.com/GMOD/jbrowse-components/pull/4445) Update
  oclif/test and oclif/core ([@cmdcolin](https://github.com/cmdcolin))
- [#4440](https://github.com/GMOD/jbrowse-components/pull/4440) Use ref instead
  of deprecated findDOMNode for draggable dialog
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4429](https://github.com/GMOD/jbrowse-components/pull/4429) Remove
  normalize-wheel library ([@cmdcolin](https://github.com/cmdcolin))
- [#4400](https://github.com/GMOD/jbrowse-components/pull/4400) Remove
  node-polyfill-webpack-plugin ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Caroline Bridge ([@carolinebridge](https://github.com/carolinebridge))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.71s.

yarn run v1.22.22 $ lerna-changelog --silent --silent --next-version 2.11.2

## 2.11.2 (2024-06-03)

#### :rocket: Enhancement

- Other
  - [#4406](https://github.com/GMOD/jbrowse-components/pull/4406) Allow loading
    plaintext GFF3 files larger than 512Mb
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4398](https://github.com/GMOD/jbrowse-components/pull/4398) Adds a context
    menu option to zoom to a feature
    ([@carolinebridge](https://github.com/carolinebridge))
- `core`
  - [#4405](https://github.com/GMOD/jbrowse-components/pull/4405) Include a raw
    version of function names in error message stack traces
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4393](https://github.com/GMOD/jbrowse-components/pull/4393) Allow users to
    configure filters and set them at runtime via a editable dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4395](https://github.com/GMOD/jbrowse-components/pull/4395) Remove
    x-data-grid resize bar workaround ([@cmdcolin](https://github.com/cmdcolin))
  - [#4389](https://github.com/GMOD/jbrowse-components/pull/4389) Improve return
    type of `intersection2`
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- [#4407](https://github.com/GMOD/jbrowse-components/pull/4407) Fix custom theme
  being applied in renderings in desktop
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4402](https://github.com/GMOD/jbrowse-components/pull/4402) Fix for
  rendering of softclipping when there are insertions in the sequence
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4385](https://github.com/GMOD/jbrowse-components/pull/4385) Fix ability to
  choose line plot bigwig coloring ([@cmdcolin](https://github.com/cmdcolin))
- [#4386](https://github.com/GMOD/jbrowse-components/pull/4386) Fix ability to
  add custom frame colors
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 3

- Caroline Bridge ([@carolinebridge](https://github.com/carolinebridge))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens)) Done
  in 1.23s.

yarn run v1.22.19 $ lerna-changelog --silent --silent --next-version 2.11.1

## 2.11.1 (2024-05-11)

#### :rocket: Enhancement

- `core`
  - [#4354](https://github.com/GMOD/jbrowse-components/pull/4354) Allow
    capitalizing CDS sequences and lowercasing introns in sequence feature panel
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4351](https://github.com/GMOD/jbrowse-components/pull/4351) Store and
    retrieve user track selector settings in local storage
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#4381](https://github.com/GMOD/jbrowse-components/pull/4381) Replace all
    rgba(...) color strings with rgb(...) in SVG exports to fix usage in
    illustrator/inkscape ([@cmdcolin](https://github.com/cmdcolin))
  - [#4364](https://github.com/GMOD/jbrowse-components/pull/4364) Fix tooltips
    creating a scrollbar when overflowing off the screen in Chrome
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4366](https://github.com/GMOD/jbrowse-components/pull/4366) Fix for regex
    sequence search on reverse strand features
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4362](https://github.com/GMOD/jbrowse-components/pull/4362) Auto-detect
    file format better when importing BED or TSV bookmarks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4357](https://github.com/GMOD/jbrowse-components/pull/4357) Fix bookmark
    showing up on wrong assembly/crashing
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4353](https://github.com/GMOD/jbrowse-components/pull/4353) Remove snap
    package ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`
  - [#4350](https://github.com/GMOD/jbrowse-components/pull/4350) Fix Fab
    positioning on @jbrowse/react-app ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.13s.

yarn run v1.22.19 $ lerna-changelog --silent --silent --next-version 2.11.0

## 2.11.0 (2024-04-16)

#### :rocket: Enhancement

- `core`
  - [#4341](https://github.com/GMOD/jbrowse-components/pull/4341) Improve error
    dialog stack trace display and fix usage on https sites
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4340](https://github.com/GMOD/jbrowse-components/pull/4340) Change email
    on error message dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#4288](https://github.com/GMOD/jbrowse-components/pull/4288) Create
    GCContentTrack type ([@cmdcolin](https://github.com/cmdcolin))
  - [#4312](https://github.com/GMOD/jbrowse-components/pull/4312) Update
    @mui/x-data-grid 6->7 ([@cmdcolin](https://github.com/cmdcolin))
  - [#4280](https://github.com/GMOD/jbrowse-components/pull/4280) Add JSON.parse
    utility to the "jexl function library"
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4276](https://github.com/GMOD/jbrowse-components/pull/4276) Add retry
    method to share link dialog in case of error
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4266](https://github.com/GMOD/jbrowse-components/pull/4266) Add bookmark
    highlight to overview scale bar
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Other
  - [#4335](https://github.com/GMOD/jbrowse-components/pull/4335) Add ability to
    create multiple highlights on the linear genome view
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#4287](https://github.com/GMOD/jbrowse-components/pull/4287) Fix snap
    package and also add deb package ([@cmdcolin](https://github.com/cmdcolin))
  - [#4034](https://github.com/GMOD/jbrowse-components/pull/4034) Subtler
    minicontrols focus ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `product-core`
  - [#4337](https://github.com/GMOD/jbrowse-components/pull/4337) Allow moving
    tracks and views up/down/to top/to bottom, and better click and drag track
    re-ordering ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`
  - [#4336](https://github.com/GMOD/jbrowse-components/pull/4336) Add new Hi-C
    color schemes with log scale mode ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `web-core`
  - [#4284](https://github.com/GMOD/jbrowse-components/pull/4284) Allow getting
    stack trace error dialog from session.notify errors
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#4318](https://github.com/GMOD/jbrowse-components/pull/4318) Use
    node-fetch-native to fix warning from JBrowse CLI on node 21+
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4319](https://github.com/GMOD/jbrowse-components/pull/4319) Fix Hi-C
    rendering for some high resolution files
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4314](https://github.com/GMOD/jbrowse-components/pull/4314) Fix loading of
    BED12 data from a plaintext BED with column headers
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4293](https://github.com/GMOD/jbrowse-components/pull/4293) Fix alignment
    curves showing up in inkscape for breakpoint svg
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4287](https://github.com/GMOD/jbrowse-components/pull/4287) Fix snap
    package and also add deb package ([@cmdcolin](https://github.com/cmdcolin))
  - [#4277](https://github.com/GMOD/jbrowse-components/pull/4277) Fix usage of
    --assemblyNames in `jbrowse add-connection`
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4275](https://github.com/GMOD/jbrowse-components/pull/4275) Fixes bug on
    URL highlight param in which refName aliases were not working
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- `text-indexing`
  - [#4269](https://github.com/GMOD/jbrowse-components/pull/4269) Avoid crash on
    badly encoded GFF attributes ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens)) Done
  in 1.85s.

yarn run v1.22.19 $ lerna-changelog --silent --silent --next-version 2.10.3

## 2.10.3 (2024-03-06)

#### :rocket: Enhancement

- Other
  - [#4257](https://github.com/GMOD/jbrowse-components/pull/4257) Smaller
    sequence track size ([@cmdcolin](https://github.com/cmdcolin))
  - [#4256](https://github.com/GMOD/jbrowse-components/pull/4256) Update deps
    including electron 28->29 ([@cmdcolin](https://github.com/cmdcolin))
  - [#4234](https://github.com/GMOD/jbrowse-components/pull/4234) Adds URL query
    param for highlight on LGV
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- `core`, `product-core`
  - [#4255](https://github.com/GMOD/jbrowse-components/pull/4255) Allow getting
    stack trace from track errors ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#4254](https://github.com/GMOD/jbrowse-components/pull/4254) Throw if no
  sequenceAdapter supplied to CramAdapter
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4250](https://github.com/GMOD/jbrowse-components/pull/4250) Fix the viewport
  calculations for when URL params includes &tracklist=true
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4232](https://github.com/GMOD/jbrowse-components/pull/4232) Fix for missing
  INFO.STRANDS tag for TRA features in breakpoint split view
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4224](https://github.com/GMOD/jbrowse-components/pull/4224) Fix parsing of
  BAM and CRAM refNames that contain a colon
  ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#4240](https://github.com/GMOD/jbrowse-components/pull/4240) Small fixes to
  embedding tutorial docs ([@kwentine](https://github.com/kwentine))
- [#4223](https://github.com/GMOD/jbrowse-components/pull/4223) Add FAQ section
  about faceted track selector
  ([@Maarten-vd-Sande](https://github.com/Maarten-vd-Sande))

#### Committers: 5

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Quentin Agren ([@kwentine](https://github.com/kwentine))
- [@Maarten-vd-Sande](https://github.com/Maarten-vd-Sande) Done in 1.56s.

yarn run v1.22.19 $ lerna-changelog --silent --silent --next-version 2.10.2

## 2.10.2 (2024-02-19)

#### :rocket: Enhancement

- Other
  - [#4219](https://github.com/GMOD/jbrowse-components/pull/4219) Add ability to
    render only snpcoverage in jbrowse-img
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4196](https://github.com/GMOD/jbrowse-components/pull/4196) Allow adding
    &tracklist=true to URL bar to open the track selector, &nav=false to hide
    linear genome view header ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4215](https://github.com/GMOD/jbrowse-components/pull/4215) Launch
    breakpoint split view directly from alignments feature details
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4184](https://github.com/GMOD/jbrowse-components/pull/4184) Add ability to
    get stack trace for error messages in the UI
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#4220](https://github.com/GMOD/jbrowse-components/pull/4220) Fix hydration
    error from translocation features in plaintext VCF adapter
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4217](https://github.com/GMOD/jbrowse-components/pull/4217) Fix breakpoint
    split view SVG export occasionally having wrong clipping
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4213](https://github.com/GMOD/jbrowse-components/pull/4213) Fix issue with
    tagFilter \* in alignments track ([@cmdcolin](https://github.com/cmdcolin))
  - [#4208](https://github.com/GMOD/jbrowse-components/pull/4208) Fix
    @jbrowse/img under node environment
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4146](https://github.com/GMOD/jbrowse-components/pull/4146) Remove
    --tracks and --view options from set-default-session CLI
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4190](https://github.com/GMOD/jbrowse-components/pull/4190) Remove text
    selection on sequence track with user-select: none
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`
  - [#4177](https://github.com/GMOD/jbrowse-components/pull/4177) Fix session
    tracks being displayed in the tracklist on @jbrowse/react-linear-genome-view
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#4166](https://github.com/GMOD/jbrowse-components/pull/4166) Year in review
  blog post ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.42s.

yarn run v1.22.19 $ lerna-changelog --silent --silent --next-version 2.10.1

## 2.10.1 (2024-01-09)

#### :rocket: Enhancement

- `core`
  - [#4155](https://github.com/GMOD/jbrowse-components/pull/4155) Remove
    react-svg-tooltip library ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4152](https://github.com/GMOD/jbrowse-components/pull/4152) Add
    directional feet to breakends in linear arc display
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4143](https://github.com/GMOD/jbrowse-components/pull/4143) Add webpack
    build for @jbrowse/react-app ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#4158](https://github.com/GMOD/jbrowse-components/pull/4158) Fix subfeature
    refNames on BED and BEDTabix parsers
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4154](https://github.com/GMOD/jbrowse-components/pull/4154) Fix metadata
    facet filters being blank ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4147](https://github.com/GMOD/jbrowse-components/pull/4147) Fix bad svg
    output in v2.10.0 in cases where feature names have angle brackets
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#4142](https://github.com/GMOD/jbrowse-components/pull/4142) Update
  03_assemblies.md ([@dtdoering](https://github.com/dtdoering))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Drew T. Doering ([@dtdoering](https://github.com/dtdoering)) Done in 3.10s.

yarn run v1.22.19 $ lerna-changelog --silent --silent --next-version 2.10.0

## 2.10.0 (2023-12-15)

#### :rocket: Enhancement

- `core`
  - [#4138](https://github.com/GMOD/jbrowse-components/pull/4138) Speed up large
    FromConfigAdapter usages with alternative adapter id calculation
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4114](https://github.com/GMOD/jbrowse-components/pull/4114) Improve
    pluginManager.jexl typescript definition
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#4135](https://github.com/GMOD/jbrowse-components/pull/4135) Split
    "recently used tracks" local storage keys by view assemblies
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4003](https://github.com/GMOD/jbrowse-components/pull/4003) Adds the
    ability to highlight regions using the bookmarks widget
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#4123](https://github.com/GMOD/jbrowse-components/pull/4123) Remove
    session.notify after using the Add track workflow
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3859](https://github.com/GMOD/jbrowse-components/pull/3859) Add new
    pairwise indexed PAF adapter format with CLI creation workflow
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4109](https://github.com/GMOD/jbrowse-components/pull/4109) Allow right
    clicking synteny features ([@cmdcolin](https://github.com/cmdcolin))
  - [#4110](https://github.com/GMOD/jbrowse-components/pull/4110) Scroll both
    panels of the linear synteny view when side scrolling the middle panel
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4108](https://github.com/GMOD/jbrowse-components/pull/4108) Convert to
    floating-ui for tooltips for small speedup
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4107](https://github.com/GMOD/jbrowse-components/pull/4107) Refactors and
    bundle size improvements ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`
  - [#4134](https://github.com/GMOD/jbrowse-components/pull/4134) Add ability to
    click and drag synteny area of synteny view to side scroll
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#4137](https://github.com/GMOD/jbrowse-components/pull/4137) Fix dotplot
    axis ticks going out of bounds ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4136](https://github.com/GMOD/jbrowse-components/pull/4136) Fix "Export
    SVG" feature in next 14 ([@cmdcolin](https://github.com/cmdcolin))
  - [#4125](https://github.com/GMOD/jbrowse-components/pull/4125) Fix internet
    accounts not being shown in file selector after page refresh and hide HTTP
    basic internet accounts ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `embedded-core`
  - [#4121](https://github.com/GMOD/jbrowse-components/pull/4121) Fix view menu
    checkboxes not responding in some cases
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- `app-core`, `product-core`, `web-core`
  - [#4106](https://github.com/GMOD/jbrowse-components/pull/4106) Add links
    between autogen docs ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#4103](https://github.com/GMOD/jbrowse-components/pull/4103) Add mastodon
  account to website links ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 2.06s.

yarn run v1.22.19 $ lerna-changelog --silent --silent --next-version 2.9.0

## 2.9.0 (2023-11-30)

#### :rocket: Enhancement

- Other
  - [#4070](https://github.com/GMOD/jbrowse-components/pull/4070) Add support
    for single file hubs ([@cmdcolin](https://github.com/cmdcolin))
  - [#4096](https://github.com/GMOD/jbrowse-components/pull/4096) Allow
    searching by gene name using linear synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4068](https://github.com/GMOD/jbrowse-components/pull/4068) Allow
    searching the text-index by gene name from the URL bar
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3948](https://github.com/GMOD/jbrowse-components/pull/3948) Make the
    default setting for the dotplot/synteny views use 'Existing tracks' by
    default ([@cmdcolin](https://github.com/cmdcolin))
  - [#4039](https://github.com/GMOD/jbrowse-components/pull/4039) Adds
    "Favorites" and "Recently used" track categories to the track selector
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#4067](https://github.com/GMOD/jbrowse-components/pull/4067) Add arc plugin
    to @jbrowse/react-linear-genome-view core plugins
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`
  - [#4091](https://github.com/GMOD/jbrowse-components/pull/4091) Allow hiding
    subfeatures in the feature details panel
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#4094](https://github.com/GMOD/jbrowse-components/pull/4094) Refactor
    faceted track selector to use more MST state
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4086](https://github.com/GMOD/jbrowse-components/pull/4086) Fix issue
    where --load inPlace and --force can sometimes remove file unexpectedly
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4059](https://github.com/GMOD/jbrowse-components/pull/4059) Fix missing
    icons on some cascading menus
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Other
  - [#4095](https://github.com/GMOD/jbrowse-components/pull/4095) Fix faceted
    metadata header names colliding with non-metadata header names
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4071](https://github.com/GMOD/jbrowse-components/pull/4071) Fix Mac
    auto-updates fetching non-existent zip
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4062](https://github.com/GMOD/jbrowse-components/pull/4062) Fix duplicate
    key error in hierarchical track selector from using connections
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.41s.

yarn run v1.22.19 $ lerna-changelog --silent --next-version 2.8.0

## 2.8.0 (2023-11-09)

#### :rocket: Enhancement

- Other
  - [#4045](https://github.com/GMOD/jbrowse-components/pull/4045) Create
    multi-region arc display type for variant tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4050](https://github.com/GMOD/jbrowse-components/pull/4050) Allow
    specifying alternative config.json path via global variable
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4046](https://github.com/GMOD/jbrowse-components/pull/4046) Show last
    autosave on jbrowse-web start screen
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4044](https://github.com/GMOD/jbrowse-components/pull/4044) Speed up
    "multi-region" navigation in search box
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#4032](https://github.com/GMOD/jbrowse-components/pull/4032) Add
    `jbrowse sort-gff` subcommand ([@cmdcolin](https://github.com/cmdcolin))
- `product-core`
  - [#4040](https://github.com/GMOD/jbrowse-components/pull/4040) Strip baseUri
    in 'About track' copy config ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#4035](https://github.com/GMOD/jbrowse-components/pull/4035) Prompt to
    horizontally flip view when launching linear synteny view on inverted
    feature ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`
  - [#4024](https://github.com/GMOD/jbrowse-components/pull/4024) Add
    right-handed arrow to view title to emphasize the focused view
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))

#### :bug: Bug Fix

- [#4052](https://github.com/GMOD/jbrowse-components/pull/4052) Fix browser back
  button behavior in jbrowse-web ([@cmdcolin](https://github.com/cmdcolin))
- [#4043](https://github.com/GMOD/jbrowse-components/pull/4043) Fix crash in
  "Open session" widget for sessions that have 'track-less views'
  ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#4027](https://github.com/GMOD/jbrowse-components/pull/4027) Add office hours
  and community meetings ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 2.23s.

yarn run v1.22.19 $ lerna-changelog --silent --next-version 2.7.2

## 2.7.2 (2023-10-27)

#### :rocket: Enhancement

- `core`
  - [#3923](https://github.com/GMOD/jbrowse-components/pull/3923) Proposal: Add
    "extendWorker" extension point
    ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#4020](https://github.com/GMOD/jbrowse-components/pull/4020) Allow
    configuring LGV trackLabels setting via config
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3999](https://github.com/GMOD/jbrowse-components/pull/3999) Example of
    using customElement + ShadowDOM for @jbrowse/react-linear-genome-view
    ([@AcaDemIQ](https://github.com/AcaDemIQ))
  - [#4015](https://github.com/GMOD/jbrowse-components/pull/4015) Create MacOS
    universal build of jbrowse-desktop to help M1 macs
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`
  - [#4013](https://github.com/GMOD/jbrowse-components/pull/4013) Create concept
    of global hovered state ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#4016](https://github.com/GMOD/jbrowse-components/pull/4016) Fix mouseover
  tooltip getting stuck after region select popup in dotplot
  ([@cmdcolin](https://github.com/cmdcolin))
- [#4007](https://github.com/GMOD/jbrowse-components/pull/4007) Update cram-js
  for bzip2 fix ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#4005](https://github.com/GMOD/jbrowse-components/pull/4005) Refactors and
    typescript improvements for jbrowse-web loader
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`
  - [#3994](https://github.com/GMOD/jbrowse-components/pull/3994) Refactors for
    app-core view container ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Alexey Mukhin ([@AcaDemIQ](https://github.com/AcaDemIQ))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens)) Done
  in 1.56s.

yarn run v1.22.19 $ lerna-changelog --silent --next-version 2.7.1

## 2.7.1 (2023-10-18)

#### :rocket: Enhancement

- Other
  - [#3986](https://github.com/GMOD/jbrowse-components/pull/3986) Allow editing
    step size and window size of GC content adapter
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3982](https://github.com/GMOD/jbrowse-components/pull/3982) Allow
    rendering semi-circles in the arc renderer + SVG rendering of arcs
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#3981](https://github.com/GMOD/jbrowse-components/pull/3981) Auto-create
    HTML links for URLs, and strip HTML tags where they can't be rendered
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3991](https://github.com/GMOD/jbrowse-components/pull/3991) Remove some
    non-functioning options from top level menu in @jbrowse/react-app
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3980](https://github.com/GMOD/jbrowse-components/pull/3980) Downgrade
    electron 26->25 to fix screen blanking
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3971](https://github.com/GMOD/jbrowse-components/pull/3971) Fix rendering
    multi-quantitative tracks when blank data is present
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin)) Done in 1.65s.

yarn run v1.22.18 $ lerna-changelog --next-version 2.7.0

## 2.7.0 (2023-10-04)

#### :rocket: Enhancement

- Other
  - [#3956](https://github.com/GMOD/jbrowse-components/pull/3956) Make faceted
    track selector facet filters responsive to adjacent filter selections
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3953](https://github.com/GMOD/jbrowse-components/pull/3953) Report JSON
    parse error when failing to load JSON file on desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3951](https://github.com/GMOD/jbrowse-components/pull/3951) Add jobs
    widget to jbrowse-web
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3900](https://github.com/GMOD/jbrowse-components/pull/3900) Make bookmarks
    persistent across sessions with local storage
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3896](https://github.com/GMOD/jbrowse-components/pull/3896) Upgrade oclif
    to v3 to avoid deprecation warnings
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3907](https://github.com/GMOD/jbrowse-components/pull/3907) Change the
    config.json missing screen to an "It worked!" message
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3901](https://github.com/GMOD/jbrowse-components/pull/3901) Use shortened
    VCF feature description for some types of insertions and deletions
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3840](https://github.com/GMOD/jbrowse-components/pull/3840) Adds custom
    filtering option to alignments tracks
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3832](https://github.com/GMOD/jbrowse-components/pull/3832) Adds keyboard
    shortcuts for panning and zooming on a focused view
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- `core`
  - [#3954](https://github.com/GMOD/jbrowse-components/pull/3954) Add column
    resizing for jbrowse-desktop start screen recent sessions panel
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3938](https://github.com/GMOD/jbrowse-components/pull/3938) Adds code
    improvements to GridBookmarkWidget
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3914](https://github.com/GMOD/jbrowse-components/pull/3914) Swap out NPM
    `color` library for `colord` library
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `embedded-core`
  - [#3931](https://github.com/GMOD/jbrowse-components/pull/3931) Add
    eslint-plugin-fast-refresh ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`
  - [#3916](https://github.com/GMOD/jbrowse-components/pull/3916) Use
    theme.secondary.main instead of theme.secondary.light on focusedView
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `embedded-core`, `product-core`, `text-indexing`,
  `web-core`
  - [#3502](https://github.com/GMOD/jbrowse-components/pull/3502) Update to
    react v18, mobx-react v9 ([@cmdcolin](https://github.com/cmdcolin))
  - [#3885](https://github.com/GMOD/jbrowse-components/pull/3885) Eject
    react-script config from jbrowse-web and jbrowse-desktop
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `web-core`
  - [#3831](https://github.com/GMOD/jbrowse-components/pull/3831) Adds session
    model reference to view in focus
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))

#### :bug: Bug Fix

- `app-core`, `core`
  - [#3959](https://github.com/GMOD/jbrowse-components/pull/3959) Remove type
    `any` from return value of getContainingView, getSession
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3946](https://github.com/GMOD/jbrowse-components/pull/3946) Fix setting
    multiple hierarchical defaultCollapsed config options at initialization
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3937](https://github.com/GMOD/jbrowse-components/pull/3937) Fix dev mode
    error from LGV overview scalebar ([@cmdcolin](https://github.com/cmdcolin))
  - [#3925](https://github.com/GMOD/jbrowse-components/pull/3925) Reduce amount
    of canvas commands issued to the dotplot renderer
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3924](https://github.com/GMOD/jbrowse-components/pull/3924) Fix incorrect
    tick mark label on dotplot axes happening in some cases
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3921](https://github.com/GMOD/jbrowse-components/pull/3921) Fix hydration
    warning by only rendering the SvgFeature "selected feature" and "mouseover"
    client side ([@cmdcolin](https://github.com/cmdcolin))
  - [#3910](https://github.com/GMOD/jbrowse-components/pull/3910) Fix feature
    label offsets in SVG exports with main thread RPC
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3905](https://github.com/GMOD/jbrowse-components/pull/3905) Fix alignments
    track infinite loading when applying same "Color by" or "Sort by" setting
    twice ([@cmdcolin](https://github.com/cmdcolin))
  - [#3904](https://github.com/GMOD/jbrowse-components/pull/3904) Fix "Color
    by"->"Mapping quality" for CRAM files
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3902](https://github.com/GMOD/jbrowse-components/pull/3902) Fix ability to
    use plaintext bed in add-track CLI
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3929](https://github.com/GMOD/jbrowse-components/pull/3929) Fix mouse
    getting out of sync while dragging resize handle
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3912](https://github.com/GMOD/jbrowse-components/pull/3912) Avoid
    undefined getConf on assembly.configuration safeReference
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3887](https://github.com/GMOD/jbrowse-components/pull/3887) Add forwardRef
    to wrapped re-exported lazy components
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3866](https://github.com/GMOD/jbrowse-components/pull/3866) Fix
    calculation of width of "view container title"
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3865](https://github.com/GMOD/jbrowse-components/pull/3865) Strip alpha
    from colors for improved SVG export compatibility
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3957](https://github.com/GMOD/jbrowse-components/pull/3957) Add error
  handler example for embedded components
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3913](https://github.com/GMOD/jbrowse-components/pull/3913) Add color scheme
  for pathogenicity for ClinVar config_demo track
  ([@scottcain](https://github.com/scottcain))
- [#3881](https://github.com/GMOD/jbrowse-components/pull/3881) Improve some of
  the extension point documentation ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `app-core`, `core`, `embedded-core`
  - [#3931](https://github.com/GMOD/jbrowse-components/pull/3931) Add
    eslint-plugin-fast-refresh ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3920](https://github.com/GMOD/jbrowse-components/pull/3920) Remove some
    unused "renameReference" code in static/dynamic blocks
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3882](https://github.com/GMOD/jbrowse-components/pull/3882) Minor
    refactors and typescripting improvements
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `embedded-core`, `product-core`, `web-core`
  - [#3855](https://github.com/GMOD/jbrowse-components/pull/3855) Replace
    shortid with vendored nanoid ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 4

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Scott Cain ([@scottcain](https://github.com/scottcain)) Done in 2.80s.

yarn run v1.22.18 $ lerna-changelog 2.6.3

#### :rocket: Enhancement

- Other
  - [#3830](https://github.com/GMOD/jbrowse-components/pull/3830) Refactors LGV
    synteny and pileup with shared mixins
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3811](https://github.com/GMOD/jbrowse-components/pull/3811) Add ability to
    show/hide all tracks in category ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`
  - [#3810](https://github.com/GMOD/jbrowse-components/pull/3810) Add sorting
    and collapsing options to the hierarchical track selector
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3827](https://github.com/GMOD/jbrowse-components/pull/3827) Add check for
    document.activeElement == INPUT before undo/redo
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#3839](https://github.com/GMOD/jbrowse-components/pull/3839) Fix bug where
  multi-quantitative tracks plotted incorrectly for some bigwigs with empty
  regions ([@cmdcolin](https://github.com/cmdcolin))
- [#3837](https://github.com/GMOD/jbrowse-components/pull/3837) Fix text layout
  in dotplots with long coordinate strings
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3825](https://github.com/GMOD/jbrowse-components/pull/3825) Fix SVG export
  compatibility by removing rgba strings
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3814](https://github.com/GMOD/jbrowse-components/pull/3814) Fix suspense
  fallback to track container for lazy loaded display components
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3808](https://github.com/GMOD/jbrowse-components/pull/3808) Fix track
  ordering of hierarchical track selector to more closely match the config.json
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3806](https://github.com/GMOD/jbrowse-components/pull/3806) Fix a bug on the
  BookmarkWidget mui data grid where labels were not saving
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- [#3804](https://github.com/GMOD/jbrowse-components/pull/3804) Fix version
  missing from about menu in @jbrowse/react-app
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#3818](https://github.com/GMOD/jbrowse-components/pull/3818) Miscellaneous
  plugin store code refactoring ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Robert Buels ([@rbuels](https://github.com/rbuels)) Done in 1.50s.

yarn run v1.22.18 $ lerna-changelog 2.6.2

#### :rocket: Enhancement

- [#3796](https://github.com/GMOD/jbrowse-components/pull/3796) Allow workers to
  load CJS plugins ([@garrettjstevens](https://github.com/garrettjstevens))
- [#3783](https://github.com/GMOD/jbrowse-components/pull/3783) Add ability for
  track selector button in synteny view to select individual views
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3452](https://github.com/GMOD/jbrowse-components/pull/3452) Use notarytool
  for macOS desktop signing ([@cmdcolin](https://github.com/cmdcolin))
- [#3766](https://github.com/GMOD/jbrowse-components/pull/3766) Add nextjs
  circular genome view demo ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3798](https://github.com/GMOD/jbrowse-components/pull/3798) Fix VCF
    feature starting at 1-based 1 ([@cmdcolin](https://github.com/cmdcolin))
  - [#3775](https://github.com/GMOD/jbrowse-components/pull/3775) Fix stranded
    RNA-seq rendering and rename option Color by -> "First-of-pair strand"
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3758](https://github.com/GMOD/jbrowse-components/pull/3758) Adds safety
    checks on AlignmentsDisplay properties to avoid undefined rendering
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3770](https://github.com/GMOD/jbrowse-components/pull/3770) Fix potential
    issue with display searchFeatureByID being undefined
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3784](https://github.com/GMOD/jbrowse-components/pull/3784) Fix synteny
    rubberband tooltips when views are exactly the same
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3782](https://github.com/GMOD/jbrowse-components/pull/3782) Fix crash on
    color picker component using debounce on color property
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3767](https://github.com/GMOD/jbrowse-components/pull/3767) Check session
    tracks for text search adapters
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `app-core`, `core`, `embedded-core`, `product-core`, `text-indexing`,
  `web-core`
  - [#3771](https://github.com/GMOD/jbrowse-components/pull/3771) Use
    inlineSourceMaps for tsc builds and other misc changes
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#3794](https://github.com/GMOD/jbrowse-components/pull/3794) Move embedded
    demos to individual repos ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`
  - [#3786](https://github.com/GMOD/jbrowse-components/pull/3786) Centralize
    rpcWorker in product-core ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens)) Done
  in 1.55s.

yarn run v1.22.18 $ lerna-changelog 2.6.1

#### :rocket: Enhancement

- Other
  - [#3743](https://github.com/GMOD/jbrowse-components/pull/3743) Create mixin
    for shared code between LinearWiggleDisplay and MultiWiggleLinearDisplay
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3711](https://github.com/GMOD/jbrowse-components/pull/3711) Allow synteny
    data adapters to open files larger than 512Mb
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3639](https://github.com/GMOD/jbrowse-components/pull/3639) Add button to
    bookmark in jbrowse-web share dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3631](https://github.com/GMOD/jbrowse-components/pull/3631) Add BEDPE add
    track workflow, avoid showing "Add track" when disabled
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3700](https://github.com/GMOD/jbrowse-components/pull/3700) Render
    alignment track arcs instantly after bpPerPx change
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3695](https://github.com/GMOD/jbrowse-components/pull/3695) Reduce
    re-drawing on alignments track paired read arcs/cloud display types
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3725](https://github.com/GMOD/jbrowse-components/pull/3725) Filter tracks
    that match all view.assemblyNames in multi-assembly track selector modes
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3531](https://github.com/GMOD/jbrowse-components/pull/3531) Add
    @jbrowse/react-app embedded component
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3653](https://github.com/GMOD/jbrowse-components/pull/3653) Evaluate
    extension point on track config pre-process snapshot
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3706](https://github.com/GMOD/jbrowse-components/pull/3706) Miscellaneous
    alignments arc/cloud fixes ([@cmdcolin](https://github.com/cmdcolin))
  - [#3698](https://github.com/GMOD/jbrowse-components/pull/3698) Add column
    resizers to the variant ANN/CSQ panels
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `product-core`, `web-core`
  - [#3531](https://github.com/GMOD/jbrowse-components/pull/3531) Add
    @jbrowse/react-app embedded component
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`
  - [#3707](https://github.com/GMOD/jbrowse-components/pull/3707) Improved read
    cloud display for long reads with inversions
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#3749](https://github.com/GMOD/jbrowse-components/pull/3749) Avoid
    re-prompting a user login when refresh token is processed
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3572](https://github.com/GMOD/jbrowse-components/pull/3572) Add OAuth and
    HTTP BasicAuth servers for local testing, fix some OAuth flows
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3708](https://github.com/GMOD/jbrowse-components/pull/3708) Add
    removable-media to jbrowse desktop snap
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3687](https://github.com/GMOD/jbrowse-components/pull/3687) Take into
    account ML tag when showing MM tag on alignments, misc refactoring
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3747](https://github.com/GMOD/jbrowse-components/pull/3747) Fix blank
    lines in GFF crashing text-index ([@cmdcolin](https://github.com/cmdcolin))
  - [#3739](https://github.com/GMOD/jbrowse-components/pull/3739) Fix specifying
    the assemblyNames config slot on add-connection CLI
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3631](https://github.com/GMOD/jbrowse-components/pull/3631) Add BEDPE add
    track workflow, avoid showing "Add track" when disabled
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3667](https://github.com/GMOD/jbrowse-components/pull/3667) Fix horizontal
    flip functionality for Hi-C display
    ([@studentshivang](https://github.com/studentshivang))
  - [#3703](https://github.com/GMOD/jbrowse-components/pull/3703) Fix rendering
    error in alignments tracks when filtering by tag in CRAM file
    ([@Lilas-w](https://github.com/Lilas-w))
  - [#3694](https://github.com/GMOD/jbrowse-components/pull/3694) Fix ability to
    filter certain fields in BAM/CRAM files
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3691](https://github.com/GMOD/jbrowse-components/pull/3691) Fix breakpoint
    split view alignment connections not pointing at right position in v2.5.0
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3686](https://github.com/GMOD/jbrowse-components/pull/3686) Fix jbrowse
    create/jbrowse upgrade CLI intermittent failures
    ([@cmdcolin](https://github.com/cmdcolin))
- `product-core`, `web-core`
  - [#3738](https://github.com/GMOD/jbrowse-components/pull/3738) Don't throw on
    UCSC connection containing assemblies not matching connection->assemblyNames
    config ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `embedded-core`
  - [#3731](https://github.com/GMOD/jbrowse-components/pull/3731) Fix view menu
    going off screen in some cases ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`
  - [#3713](https://github.com/GMOD/jbrowse-components/pull/3713) Fix centering
    of the ImportForm on SV inspector ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- Other
  - [#3752](https://github.com/GMOD/jbrowse-components/pull/3752) Add storybook
    example for fetching features currently in view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3732](https://github.com/GMOD/jbrowse-components/pull/3732) Add JBrowse R
    shiny app demo
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3693](https://github.com/GMOD/jbrowse-components/pull/3693) Remove package
    table from release blogposts ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `embedded-core`, `product-core`
  - [#3704](https://github.com/GMOD/jbrowse-components/pull/3704) Organize
    autogenerated docs into categories
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `app-core`, `core`, `product-core`, `text-indexing`
  - [#3740](https://github.com/GMOD/jbrowse-components/pull/3740) Bump electron,
    proxy-agent, fontsource-roboto, etc. and update SnackbarMessage from typed
    array to object ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3741](https://github.com/GMOD/jbrowse-components/pull/3741) Distinguish
    between SessionWithConnections and SessionWithConnectionEditing
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3734](https://github.com/GMOD/jbrowse-components/pull/3734) PileupRenderer
    refactor ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `product-core`, `web-core`
  - [#3717](https://github.com/GMOD/jbrowse-components/pull/3717) More
    modularizing of shared app code ([@cmdcolin](https://github.com/cmdcolin))
- `product-core`
  - [#3709](https://github.com/GMOD/jbrowse-components/pull/3709) Silence
    console warn in CopyAndDelete test
    ([@cmdcolin](https://github.com/cmdcolin))
- `app-core`, `core`, `embedded-core`, `product-core`, `text-indexing`
  - [#3701](https://github.com/GMOD/jbrowse-components/pull/3701) Create
    app-core and embedded-core packages
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `product-core`
  - [#3661](https://github.com/GMOD/jbrowse-components/pull/3661) Create
    packages/product-core containing shared code between the various products
    ([@rbuels](https://github.com/rbuels))

#### Committers: 6

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Robert Buels ([@rbuels](https://github.com/rbuels))
- Shivang Dwivedi ([@studentshivang](https://github.com/studentshivang))
- [@Lilas-w](https://github.com/Lilas-w) Done in 2.84s.

## 2.5.0 (2023-05-04)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3675](https://github.com/GMOD/jbrowse-components/pull/3675) Use
    react-popper for tooltips in DotplotView
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3637](https://github.com/GMOD/jbrowse-components/pull/3637) Fix
    renderDelay not being applied to dynamicBlocks
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3677](https://github.com/GMOD/jbrowse-components/pull/3677) Adjust
    RefNameAutocomplete width calculation to avoid ellipses
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3660](https://github.com/GMOD/jbrowse-components/pull/3660) Bump
    x-data-grid dependency, refactors for BaseFeatureDetails, add GridToolbar
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3626](https://github.com/GMOD/jbrowse-components/pull/3626) Update to mui
    x-data-grid 6 ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#3681](https://github.com/GMOD/jbrowse-components/pull/3681) Guard against
    undefined in CoreGetFeatureDetails
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3662](https://github.com/GMOD/jbrowse-components/pull/3662) Fix empty
    feature sequence on top-level gene feature
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3666](https://github.com/GMOD/jbrowse-components/pull/3666) Fix text boxes
    being too small in Dialog boxes ([@cmdcolin](https://github.com/cmdcolin))
  - [#3642](https://github.com/GMOD/jbrowse-components/pull/3642) Fix error
    handling of feature detail formatter jexl callbacks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3621](https://github.com/GMOD/jbrowse-components/pull/3621) Update plugin
    rollup polyfill package
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3620](https://github.com/GMOD/jbrowse-components/pull/3620) Fix potential
    crashes where alignment SEQ field may be empty, simplify some display model
    code ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3670](https://github.com/GMOD/jbrowse-components/pull/3670) Only
    double-click zoom if not clicking on feature
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3652](https://github.com/GMOD/jbrowse-components/pull/3652) Fix text being
    invisible on overview scalebar when cytobands shown
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3632](https://github.com/GMOD/jbrowse-components/pull/3632) Fix mouse
    click-and-drag behavior in the alternative "cursor mode" for the dotplot
    view ([@cmdcolin](https://github.com/cmdcolin))
  - [#3625](https://github.com/GMOD/jbrowse-components/pull/3625) Fix UCSC
    trackhub assembly aliases matching
    ([@andrzejgrzelak](https://github.com/andrzejgrzelak))
- `__mocks__`, `core`
  - [#3630](https://github.com/GMOD/jbrowse-components/pull/3630) Fix flakiness
    of connection test ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- Other
  - [#3676](https://github.com/GMOD/jbrowse-components/pull/3676) Refactor
    circular genome view storybook ([@cmdcolin](https://github.com/cmdcolin))
  - [#3671](https://github.com/GMOD/jbrowse-components/pull/3671) Fix website
    documentation sidebar on browsers with prefers-reduced-motion
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3654](https://github.com/GMOD/jbrowse-components/pull/3654) Add some docs
    for configuring defaultSession ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3646](https://github.com/GMOD/jbrowse-components/pull/3646) Refactor
    linear genome view storybook ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#3647](https://github.com/GMOD/jbrowse-components/pull/3647) Refactoring
    navToMultiple, navToLocString, and related
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3629](https://github.com/GMOD/jbrowse-components/pull/3629) Typescript
    checking for config slot names ([@rbuels](https://github.com/rbuels))
  - [#3618](https://github.com/GMOD/jbrowse-components/pull/3618) Rename APIs
    for feature density stats and quantitative stats
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3615](https://github.com/GMOD/jbrowse-components/pull/3615) Add check for
    default export to plugin loader ([@rbuels](https://github.com/rbuels))

#### Committers: 4

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Robert Buels ([@rbuels](https://github.com/rbuels))
- [@andrzejgrzelak](https://github.com/andrzejgrzelak)

## 2.4.2 (2023-03-27)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#3604](https://github.com/GMOD/jbrowse-components/pull/3604) Alignments
    tags description in feature details on mouseover
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3586](https://github.com/GMOD/jbrowse-components/pull/3586) Add
    authorization(internetAccount) support for Trix index files
    ([@andrzejgrzelak](https://github.com/andrzejgrzelak))

#### :bug: Bug Fix

- Other
  - [#3610](https://github.com/GMOD/jbrowse-components/pull/3610) Avoid cutting
    off import form of spreadsheet view, fix overflowed text in table header
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3600](https://github.com/GMOD/jbrowse-components/pull/3600) Fix using the
    force load button after a stats timeout
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3592](https://github.com/GMOD/jbrowse-components/pull/3592) Fix shading on
    synteny features after mouseout ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#3608](https://github.com/GMOD/jbrowse-components/pull/3608) Fix
    subfeatures formatter not being applied to feature detail panel
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3607](https://github.com/GMOD/jbrowse-components/pull/3607) Avoid
    "ResizeObserver" loop warning during development
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3593](https://github.com/GMOD/jbrowse-components/pull/3593) Fix gene
    without subfeatures not being displayed in sequence feature details
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#3611](https://github.com/GMOD/jbrowse-components/pull/3611) Use local data
  instead of remote data for LGV component test
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- [@andrzejgrzelak](https://github.com/andrzejgrzelak)

## 2.4.1 (2023-03-14)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          | https://www.npmjs.com/package/@jbrowse/plugin-authentication      |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#3534](https://github.com/GMOD/jbrowse-components/pull/3534) Improve
    visibility of SNPs on alignments track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3561](https://github.com/GMOD/jbrowse-components/pull/3561) Add scroll
    zoom, d-pad, and more click+drag options to dotplot
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3574](https://github.com/GMOD/jbrowse-components/pull/3574) Add ability to
    load all built-in synteny data sources from @jbrowse/cli
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3564](https://github.com/GMOD/jbrowse-components/pull/3564) Use
    double-click to zoom in on particular offset in LGV, and make ctrl+scroll
    also zoom in on particular offset ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#3578](https://github.com/GMOD/jbrowse-components/pull/3578) Fix selected
  synteny feature getting unselected after scroll
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3566](https://github.com/GMOD/jbrowse-components/pull/3566) Fix use of "show
  all regions with data" feature in SV inspector with TRA entries (with CHR2
  from INFO) ([@cmdcolin](https://github.com/cmdcolin))
- [#3558](https://github.com/GMOD/jbrowse-components/pull/3558) Fix visual
  effect from using the overview scalebar click and dragging backwards
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3556](https://github.com/GMOD/jbrowse-components/pull/3556) Fix infinite
  loading state when no synteny features are visible in synteny view
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3551](https://github.com/GMOD/jbrowse-components/pull/3551) Fix bad layout
  on tabix tracks that have Unicode characters
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3548](https://github.com/GMOD/jbrowse-components/pull/3548) Fix upper case
  querying of jbrowse 1 text search store
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3545](https://github.com/GMOD/jbrowse-components/pull/3545) Fix issue where
  clearing search box on LGV import form turns search box into loading bar
  ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3571](https://github.com/GMOD/jbrowse-components/pull/3571) Fixing link to
  PAG 2023 tutorial ([@scottcain](https://github.com/scottcain))

#### :house: Internal

- Other
  - [#3567](https://github.com/GMOD/jbrowse-components/pull/3567) Update github
    actions workflows to newer versions
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`, `text-indexing`
  - [#3557](https://github.com/GMOD/jbrowse-components/pull/3557) Add additional
    lint rules from typescript-eslint and eslint-plugin-unicorn
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Scott Cain ([@scottcain](https://github.com/scottcain))

## 2.4.0 (2023-02-24)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          | https://www.npmjs.com/package/@jbrowse/plugin-authentication      |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3527](https://github.com/GMOD/jbrowse-components/pull/3527) Breakpoint
    split view SVG export ([@cmdcolin](https://github.com/cmdcolin))
  - [#3510](https://github.com/GMOD/jbrowse-components/pull/3510) Allow
    configuring default display height
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3513](https://github.com/GMOD/jbrowse-components/pull/3513) Add ability to
    open refNameAliases+cytobands in "Open sequence" start screen on desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3512](https://github.com/GMOD/jbrowse-components/pull/3512) SVG export of
    linear synteny view, dotplot, and circular views
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3467](https://github.com/GMOD/jbrowse-components/pull/3467) Create dark
    theme and allow user to toggle different themes from preferences dialog
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#3525](https://github.com/GMOD/jbrowse-components/pull/3525) Fix missing grid
  ticks in dotplot ([@cmdcolin](https://github.com/cmdcolin))
- [#3524](https://github.com/GMOD/jbrowse-components/pull/3524) Fix loading
  session shares that have a plus sign in the sessionId
  ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3532](https://github.com/GMOD/jbrowse-components/pull/3532) Check website
  links in CI ([@cmdcolin](https://github.com/cmdcolin))
- [#3507](https://github.com/GMOD/jbrowse-components/pull/3507) Fix mygene.info
  demo track ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 2.3.4 (2023-02-01)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#3494](https://github.com/GMOD/jbrowse-components/pull/3494) Use
    transitionDuration 0 as defaultProp in theme for both popovers and menus
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3488](https://github.com/GMOD/jbrowse-components/pull/3488) Render HTML in
    faceted track selector for track data/metadata
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3483](https://github.com/GMOD/jbrowse-components/pull/3483) Add
    anchorOrigin/transformOrigin to default menu component
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3470](https://github.com/GMOD/jbrowse-components/pull/3470) Variant sample
    grid auto-size columns and resizer
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3304](https://github.com/GMOD/jbrowse-components/pull/3304) Faceted/data
    grid style track selector ([@cmdcolin](https://github.com/cmdcolin))
  - [#3477](https://github.com/GMOD/jbrowse-components/pull/3477) Larger margins
    to add track workflow to visually clarify next button behavior
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3475](https://github.com/GMOD/jbrowse-components/pull/3475) Bypass
    plugins.json download if unneeded during app startup
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3458](https://github.com/GMOD/jbrowse-components/pull/3458) Improve
    auto-update of sequence track height when toggling
    forward/reverse/translation settings
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#3482](https://github.com/GMOD/jbrowse-components/pull/3482) Fix loading
    external plugins in embedded linear-genome-view demo
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3457](https://github.com/GMOD/jbrowse-components/pull/3457) Fix synteny
    view not drawing after horizontal flip in v2.3.3
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3459](https://github.com/GMOD/jbrowse-components/pull/3459) Booleanize
    localstorage settings from older versions of LGV to avoid crash
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3487](https://github.com/GMOD/jbrowse-components/pull/3487) Storybook 7
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3464](https://github.com/GMOD/jbrowse-components/pull/3464) Add source file
  to config/state model docs ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 2.3.3 (2023-01-11)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          | https://www.npmjs.com/package/@jbrowse/plugin-authentication      |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gccontent               | https://www.npmjs.com/package/@jbrowse/plugin-gccontent           |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#3440](https://github.com/GMOD/jbrowse-components/pull/3440) "Show all
    regions" for dotplot and synteny views and refactor synteny rendering RPC to
    optimize scrolling ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3451](https://github.com/GMOD/jbrowse-components/pull/3451) Fix
    auto-updates on desktop not working since v2.2.2
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3428](https://github.com/GMOD/jbrowse-components/pull/3428) Add missing
    dependencies to embedded component package.json's
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3448](https://github.com/GMOD/jbrowse-components/pull/3448) Typescriptify
  some docusaurus website code ([@cmdcolin](https://github.com/cmdcolin))
- [#3444](https://github.com/GMOD/jbrowse-components/pull/3444) Human vs mouse
  synteny demo ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#3445](https://github.com/GMOD/jbrowse-components/pull/3445) Typescriptify
    more tests ([@cmdcolin](https://github.com/cmdcolin))
  - [#3443](https://github.com/GMOD/jbrowse-components/pull/3443) Restore
    console mocks after running ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 2.3.2 (2022-12-20)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gccontent               | https://www.npmjs.com/package/@jbrowse/plugin-gccontent           |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#3422](https://github.com/GMOD/jbrowse-components/pull/3422) Auto-adjust
    height of reference sequence track to current settings
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3421](https://github.com/GMOD/jbrowse-components/pull/3421) Add ability to
    revcomp sequence in the "Get sequence" dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3413](https://github.com/GMOD/jbrowse-components/pull/3413) Add a "base"
    set of tracks and assemblies for the embedded demos
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#3419](https://github.com/GMOD/jbrowse-components/pull/3419) Fix rendering
  base-level alignments on synteny visualizations, especially in inverted
  regions ([@cmdcolin](https://github.com/cmdcolin))
- [#3416](https://github.com/GMOD/jbrowse-components/pull/3416) Fix rendering
  alignment arcs on files that need refname renaming and add jitter setting
  ([@cmdcolin](https://github.com/cmdcolin))
- [#3415](https://github.com/GMOD/jbrowse-components/pull/3415) Fix circular
  view being rendered as a blank area if tab is opened in the background
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |

</p>
</details>

## 2.3.0 (2022-12-15)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          | https://www.npmjs.com/package/@jbrowse/plugin-authentication      |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gccontent               | https://www.npmjs.com/package/@jbrowse/plugin-gccontent           |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3403](https://github.com/GMOD/jbrowse-components/pull/3403) Reduce
    overplotting on dotplot grid lines and other misc improvements
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3381](https://github.com/GMOD/jbrowse-components/pull/3381) Add method for
    cache busting requests to the config file in jbrowse-web
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3384](https://github.com/GMOD/jbrowse-components/pull/3384) Add method to
    more easily create compact view of alignments
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3391](https://github.com/GMOD/jbrowse-components/pull/3391) Allow arc
    display to connect to "unpaired" positions using RNEXT/PNEXT or SA tag
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3387](https://github.com/GMOD/jbrowse-components/pull/3387) Small UI
    tweaks for add track workflow ([@cmdcolin](https://github.com/cmdcolin))
  - [#3358](https://github.com/GMOD/jbrowse-components/pull/3358) Create new
    "arc" display type to show long range connections between paired-end and
    split-reads ([@cmdcolin](https://github.com/cmdcolin))
- `text-indexing`
  - [#3385](https://github.com/GMOD/jbrowse-components/pull/3385) Optimize
    prefix size for text indexing automatically
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3407](https://github.com/GMOD/jbrowse-components/pull/3407) Remove
    trackhub registry plugin from core plugins, moved to plugin store
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3406](https://github.com/GMOD/jbrowse-components/pull/3406) Fix loading
    connection tracks from connections that don't specify assemblyNames in
    config ([@cmdcolin](https://github.com/cmdcolin))
  - [#3390](https://github.com/GMOD/jbrowse-components/pull/3390) Fix
    positioning within large alignments for query->target LGV synteny navigation
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3388](https://github.com/GMOD/jbrowse-components/pull/3388) Fix search
    result that matches synonyms that matches multiple locations
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3404](https://github.com/GMOD/jbrowse-components/pull/3404) Fix
    double-render of some synteny features
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3401](https://github.com/GMOD/jbrowse-components/pull/3401) Remove
    y-scalebar rendering placeholder values in blank and loading states
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3389](https://github.com/GMOD/jbrowse-components/pull/3389) Fix issue
    where snackbar would not show up when same error message is triggered
    multiple times ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- `core`
  - [#3396](https://github.com/GMOD/jbrowse-components/pull/3396) Use prettier
    to word wrap markdown prose ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3383](https://github.com/GMOD/jbrowse-components/pull/3383) Add note to
    user guide about variant callers that can be used for SV inspector
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `__mocks__`, `core`, `text-indexing`
  - [#3400](https://github.com/GMOD/jbrowse-components/pull/3400) Reduce
    peerDependency warnings from installing dev environment
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3394](https://github.com/GMOD/jbrowse-components/pull/3394) Simplify RPC
    watchWorker ([@cmdcolin](https://github.com/cmdcolin))
  - [#3386](https://github.com/GMOD/jbrowse-components/pull/3386) Fix warning
    when rendering circular chord displays with web worker RPC
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 2.2.2 (2022-12-06)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          | https://www.npmjs.com/package/@jbrowse/plugin-authentication      |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gccontent               | https://www.npmjs.com/package/@jbrowse/plugin-gccontent           |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3350](https://github.com/GMOD/jbrowse-components/pull/3350) Retain feature
    labels in compact display mode for SVG features, and allow turning off
    keeping feature description without feature label
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3357](https://github.com/GMOD/jbrowse-components/pull/3357) Allow holding
    shift key to create rubberband selection on LGV
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3363](https://github.com/GMOD/jbrowse-components/pull/3363) Create
    remove-track CLI command ([@cmdcolin](https://github.com/cmdcolin))
  - [#3341](https://github.com/GMOD/jbrowse-components/pull/3341) Add BEDPE
    adapter type ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3359](https://github.com/GMOD/jbrowse-components/pull/3359) Fix typos in
    codebase using typos-cli ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3377](https://github.com/GMOD/jbrowse-components/pull/3377) Fix rendering
    and clicking synteny features when using MainThreadRpc
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3375](https://github.com/GMOD/jbrowse-components/pull/3375) Fix
    `jbrowse upgrade` CLI command overwriting config.json with --branch or
    --nightly options ([@cmdcolin](https://github.com/cmdcolin))
  - [#3370](https://github.com/GMOD/jbrowse-components/pull/3370) Fix error with
    SNPCoverage not rendering MM tag modifications in some cases
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3366](https://github.com/GMOD/jbrowse-components/pull/3366) Fix ability to
    use LGV synteny track on inverted alignments
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3348](https://github.com/GMOD/jbrowse-components/pull/3348) Fix for
    breakpoint split view and circular view issues with `<TRA>` type entries in
    v2.2.1 ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3369](https://github.com/GMOD/jbrowse-components/pull/3369) Fix uncaught
    promise errors and add lint rule for catching these
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3347](https://github.com/GMOD/jbrowse-components/pull/3347) Reduce number of
  quickstart guides ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#3368](https://github.com/GMOD/jbrowse-components/pull/3368) Create base
    "Dialog" component to standardize dialogs across codebase
    ([@cmdcolin](https://github.com/cmdcolin))
- `text-indexing`
  - [#3344](https://github.com/GMOD/jbrowse-components/pull/3344) fix yarn build
    error in Windows ([@Lilas-w](https://github.com/Lilas-w))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- [@Lilas-w](https://github.com/Lilas-w)

## 2.2.1 (2022-11-21)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          | https://www.npmjs.com/package/@jbrowse/plugin-authentication      |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gccontent               | https://www.npmjs.com/package/@jbrowse/plugin-gccontent           |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3277](https://github.com/GMOD/jbrowse-components/pull/3277) Create new
    "Add track workflow" that allows pasting JSON track configs
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3328](https://github.com/GMOD/jbrowse-components/pull/3328) Add GC content
    display type to the reference sequence track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3316](https://github.com/GMOD/jbrowse-components/pull/3316) Add LGV
    typescripting to @jbrowse/react-linear-genome-view
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3298](https://github.com/GMOD/jbrowse-components/pull/3298) Add
    authentication plugin to embedded components
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3329](https://github.com/GMOD/jbrowse-components/pull/3329) Add ability to
    minimize/collapse tracks and views and move views up/down in view stack
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3308](https://github.com/GMOD/jbrowse-components/pull/3308) Add ability to
    display synteny track in a normal LGV showing regions of synteny as features
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3317](https://github.com/GMOD/jbrowse-components/pull/3317) Move
    ErrorBoundary so that tracks/views that have crashed can be closed more
    easily ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3342](https://github.com/GMOD/jbrowse-components/pull/3342) Fix CRAM
    mismatches calculation regression in v2.2.0
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3319](https://github.com/GMOD/jbrowse-components/pull/3319) Fix pileup
    "sort by" setting being lost on zoom level change
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3340](https://github.com/GMOD/jbrowse-components/pull/3340) Fix linear
    genome view import form going into infinite loading state changing
    assemblies with same refnames ([@cmdcolin](https://github.com/cmdcolin))
  - [#3339](https://github.com/GMOD/jbrowse-components/pull/3339) Fix force flag
    for drawing large regions and node-fetch polyfill for node 18 fix in
    @jbrowse/img ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 2.2.0 (2022-11-04)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          | https://www.npmjs.com/package/@jbrowse/plugin-authentication      |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3296](https://github.com/GMOD/jbrowse-components/pull/3296) Add option to
    use OAuth "state" param in internet accounts
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3285](https://github.com/GMOD/jbrowse-components/pull/3285) Use typescript
    version of @gmod/cram ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3299](https://github.com/GMOD/jbrowse-components/pull/3299) Add ability to
    open a synteny track directly from the dotplot/linear synteny view import
    forms ([@cmdcolin](https://github.com/cmdcolin))
  - [#3287](https://github.com/GMOD/jbrowse-components/pull/3287) Lazy-load
    assemblies on demand instead of all at app startup
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3279](https://github.com/GMOD/jbrowse-components/pull/3279) Remove
    unnecessary expanded region query and small refactors
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#3309](https://github.com/GMOD/jbrowse-components/pull/3309) Fix animated
    "Loading..." message keyframes ([@cmdcolin](https://github.com/cmdcolin))
  - [#3306](https://github.com/GMOD/jbrowse-components/pull/3306) Fix the
    RefNameAutocomplete displaying a stale value for chromosome names
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3302](https://github.com/GMOD/jbrowse-components/pull/3302) Improve
    rubberband zooming across elided regions
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3293](https://github.com/GMOD/jbrowse-components/pull/3293) Fix CRAM
    plotting for data files that encode insertions in uncommon way
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- `core`, `text-indexing`
  - [#3278](https://github.com/GMOD/jbrowse-components/pull/3278) Auto-generate
    docs ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#3310](https://github.com/GMOD/jbrowse-components/pull/3310) Remove
  CacheProvider emotion cache ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Scott Cain ([@scottcain](https://github.com/scottcain))

## 2.1.7 (2022-10-20)

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |

</p>
</details>

#### :bug: Bug Fix

- [#3282](https://github.com/GMOD/jbrowse-components/pull/3282) Fix for embedded
  build with webpack 4 failing with v2.1.6
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 2.1.6 (2022-10-19)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| jbrowse-predefined-sessions             |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3272](https://github.com/GMOD/jbrowse-components/pull/3272) Disable
    resolution of Derives_from fields in GFF3 parsing, fixes TAIR gff
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3254](https://github.com/GMOD/jbrowse-components/pull/3254) Use tick
    labels that correspond to the overview's larger zoom level
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3230](https://github.com/GMOD/jbrowse-components/pull/3230) Add ability to
    customize About dialog with callbacks and optionally hide links to data
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3275](https://github.com/GMOD/jbrowse-components/pull/3275) Add help
    dialog for feature sequence panel ([@cmdcolin](https://github.com/cmdcolin))
  - [#3250](https://github.com/GMOD/jbrowse-components/pull/3250) Handle
    alternate line endings
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3252](https://github.com/GMOD/jbrowse-components/pull/3252) Fix gene
    sequence fetching in embedded, and allow fetching genomic sequence for other
    feature types ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `text-indexing`
  - [#3276](https://github.com/GMOD/jbrowse-components/pull/3276) Allow using
    web worker RPC on embedded LGV ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#3266](https://github.com/GMOD/jbrowse-components/pull/3266) Fix relative
    path loading of plugins ([@cmdcolin](https://github.com/cmdcolin))
  - [#3269](https://github.com/GMOD/jbrowse-components/pull/3269) Fix ability to
    rename session in web/desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#3256](https://github.com/GMOD/jbrowse-components/pull/3256) Fix tracks
    hanging in safari and polyfill for bigwig tracks
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3274](https://github.com/GMOD/jbrowse-components/pull/3274) Update bbi-js
    for bugfix on webpack 4 ([@cmdcolin](https://github.com/cmdcolin))
  - [#3259](https://github.com/GMOD/jbrowse-components/pull/3259) Fix issue with
    breakpoint split view using view before initialized
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3255](https://github.com/GMOD/jbrowse-components/pull/3255) Add more docs
  about color callbacks ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#3261](https://github.com/GMOD/jbrowse-components/pull/3261) Fix for flaky
    test ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Scott Cain ([@scottcain](https://github.com/scottcain))

## 2.1.5 (2022-10-03)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3200](https://github.com/GMOD/jbrowse-components/pull/3200) Use Alert
    component for track messages
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3229](https://github.com/GMOD/jbrowse-components/pull/3229) Allow user to
    select local assembly to add tracks to for trackhub registry
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3220](https://github.com/GMOD/jbrowse-components/pull/3220) Improve error
    reporting on SV inspector/spreadsheet view on import form
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3198](https://github.com/GMOD/jbrowse-components/pull/3198) Improve error
    reporting on jbrowse-web start screen when user attempts to open a broken
    recent session
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- `core`
  - [#3223](https://github.com/GMOD/jbrowse-components/pull/3223) Allow adding
    session tracks to embedded react component along with disableAddTracks
    option if unwanted ([@cmdcolin](https://github.com/cmdcolin))
  - [#3227](https://github.com/GMOD/jbrowse-components/pull/3227) Add
    infrastructure for creating linear-genome-view sub-classes
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3215](https://github.com/GMOD/jbrowse-components/pull/3215) Add error
    boundary on view, track, and drawer widget
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3216](https://github.com/GMOD/jbrowse-components/pull/3216) Add ability to
    set number of bp to fetch up/down stream/inside intron in feature details
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3241](https://github.com/GMOD/jbrowse-components/pull/3241) Fix local
    session failing to load copying between tabs in some cases
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3234](https://github.com/GMOD/jbrowse-components/pull/3234) Fix circular
    embedded view failing to load in v2.1.3 and v2.1.4
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3233](https://github.com/GMOD/jbrowse-components/pull/3233) Fix legend
    being cutoff on multiwiggle tracks with wide window
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3217](https://github.com/GMOD/jbrowse-components/pull/3217) Fix loading
    tracks from connection using assembly alias
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3214](https://github.com/GMOD/jbrowse-components/pull/3214) Fix trackhub
    registry failing to load in 2.x.y versions of jbrowse
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3204](https://github.com/GMOD/jbrowse-components/pull/3204) Fix
    authentication configuration on jbrowse-desktop
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3231](https://github.com/GMOD/jbrowse-components/pull/3231) Fix theme
    coloring for components that use overrides e.g. accordion summary
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :memo: Documentation

- [#3193](https://github.com/GMOD/jbrowse-components/pull/3193) Add desktop
  specific plugin tutorial
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))

#### :house: Internal

- Other
  - [#3243](https://github.com/GMOD/jbrowse-components/pull/3243) Add component
    test for circular genome view ([@cmdcolin](https://github.com/cmdcolin))
  - [#3242](https://github.com/GMOD/jbrowse-components/pull/3242) Fix flaky test
    in plugins/linear-genome-view ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3228](https://github.com/GMOD/jbrowse-components/pull/3228) Improve
    TypeScript for queueDialog
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3224](https://github.com/GMOD/jbrowse-components/pull/3224) More
    typescripting of plain js files ([@cmdcolin](https://github.com/cmdcolin))
  - [#3207](https://github.com/GMOD/jbrowse-components/pull/3207) Hardcoded
    block width of 800px on static blocks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3197](https://github.com/GMOD/jbrowse-components/pull/3197) Use
    "temporaryAssemblies" to store read vs ref assemblies, and allow selecting
    "sessionAssemblies" in dropdown ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 2.1.4 (2022-09-16)

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |

</p>
</details>

#### :bug: Bug Fix

- [#3191](https://github.com/GMOD/jbrowse-components/pull/3191) Fix the UMD
  build of the react embedded components
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 2.1.3 (2022-09-15)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3188](https://github.com/GMOD/jbrowse-components/pull/3188) Add 'Open
    saved session' button to start screen on desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3187](https://github.com/GMOD/jbrowse-components/pull/3187) Add mouseover
    tooltip descriptions to the header of the VariantFeatureDetails
    sample/genotype table ([@cmdcolin](https://github.com/cmdcolin))
  - [#3179](https://github.com/GMOD/jbrowse-components/pull/3179) Add
    extendSession extension point to web and desktop
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3178](https://github.com/GMOD/jbrowse-components/pull/3178) Allow X/Y
    assemblies of dotplot or top/bottom selection of synteny views to be either
    query or target ([@cmdcolin](https://github.com/cmdcolin))
  - [#3173](https://github.com/GMOD/jbrowse-components/pull/3173) Add ability
    for CLI to recognize plaintext BED files
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3162](https://github.com/GMOD/jbrowse-components/pull/3162) Add about
    dialog with version number for embedded components
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3163](https://github.com/GMOD/jbrowse-components/pull/3163) Note for user
    to wait before re-launching app on desktop update
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3179](https://github.com/GMOD/jbrowse-components/pull/3179) Add
    extendSession extension point to web and desktop
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3178](https://github.com/GMOD/jbrowse-components/pull/3178) Allow X/Y
    assemblies of dotplot or top/bottom selection of synteny views to be either
    query or target ([@cmdcolin](https://github.com/cmdcolin))
  - [#3173](https://github.com/GMOD/jbrowse-components/pull/3173) Add ability
    for CLI to recognize plaintext BED files
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3162](https://github.com/GMOD/jbrowse-components/pull/3162) Add about
    dialog with version number for embedded components
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3163](https://github.com/GMOD/jbrowse-components/pull/3163) Note for user
    to wait before re-launching app on desktop update
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3180](https://github.com/GMOD/jbrowse-components/pull/3180) Improve adding
    assemblies internally, and use the assembly displayName in more places in
    the UI ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3183](https://github.com/GMOD/jbrowse-components/pull/3183) Make
    pluginManager param to getFetcher optional
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3183](https://github.com/GMOD/jbrowse-components/pull/3183) Make
    pluginManager param to getFetcher optional
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- `core`
  - [#3168](https://github.com/GMOD/jbrowse-components/pull/3168) Fix search
    behavior when there are multiple matches in LGV header and when feature
    description matched in import form
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3182](https://github.com/GMOD/jbrowse-components/pull/3182) Fix "dead
    state tree node" error by creating snapshots of parent region for block
    calculations ([@cmdcolin](https://github.com/cmdcolin))
  - [#3182](https://github.com/GMOD/jbrowse-components/pull/3182) Fix "dead
    state tree node" error by creating snapshots of parent region for block
    calculations ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3170](https://github.com/GMOD/jbrowse-components/pull/3170) Fix drawing
    inverted CIGAR segments on dotplot
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3170](https://github.com/GMOD/jbrowse-components/pull/3170) Fix drawing
    inverted CIGAR segments on dotplot
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3138](https://github.com/GMOD/jbrowse-components/pull/3138) Documentation
  overhaul ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- [#3138](https://github.com/GMOD/jbrowse-components/pull/3138) Documentation
  overhaul ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))

#### :house: Internal

- Other
  - [#3179](https://github.com/GMOD/jbrowse-components/pull/3179) Add
    extendSession extension point to web and desktop
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3179](https://github.com/GMOD/jbrowse-components/pull/3179) Add
    extendSession extension point to web and desktop
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3165](https://github.com/GMOD/jbrowse-components/pull/3165) Use more
    defaults in rollup plugins
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#3183](https://github.com/GMOD/jbrowse-components/pull/3183) Make
    pluginManager param to getFetcher optional
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3164](https://github.com/GMOD/jbrowse-components/pull/3164) Typescript the
    QuickLRU module in @jbrowse/core ([@cmdcolin](https://github.com/cmdcolin))
  - [#3183](https://github.com/GMOD/jbrowse-components/pull/3183) Make
    pluginManager param to getFetcher optional
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3164](https://github.com/GMOD/jbrowse-components/pull/3164) Typescript the
    QuickLRU module in @jbrowse/core ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

## 2.1.1 (2022-08-25)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3152](https://github.com/GMOD/jbrowse-components/pull/3152) Render CSQ and
    ANN fields in VCF feature details as data grids
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3137](https://github.com/GMOD/jbrowse-components/pull/3137) Make ideogram
    menu item similar to others
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#3159](https://github.com/GMOD/jbrowse-components/pull/3159) Sequence
    search track ([@cmdcolin](https://github.com/cmdcolin))
  - [#3132](https://github.com/GMOD/jbrowse-components/pull/3132) Extend theme
    with module augmentation
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#3157](https://github.com/GMOD/jbrowse-components/pull/3157) Support the
    "name" field on multi-wiggle adapter subadapters instead of source
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3154](https://github.com/GMOD/jbrowse-components/pull/3154) Use the union
    of all the subadapter refNames for the MultiWiggleAdapter getRefNames
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3156](https://github.com/GMOD/jbrowse-components/pull/3156) Fix for
    mouseover/mouse click on wiggle/multi-wiggle causing errors in embedded mode
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3151](https://github.com/GMOD/jbrowse-components/pull/3151) Fix ability to
    click and drag overview scale bar dragging right to left
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3133](https://github.com/GMOD/jbrowse-components/pull/3133) Update the ref
    name box when assembly is changed in LGV import form
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3131](https://github.com/GMOD/jbrowse-components/pull/3131) Use "code"
    instead of "key" for undo/redo keyboard event, fixes shift+ctrl+z redo
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3119](https://github.com/GMOD/jbrowse-components/pull/3119) Use es2015
    setting for commonjs builds of packages to fix @jbrowse/img
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3142](https://github.com/GMOD/jbrowse-components/pull/3142) Fix unicode
    arrow icon not rendering with some fonts in configuration editor
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#3120](https://github.com/GMOD/jbrowse-components/pull/3120) Fix menu items
    for changing display type from track menu
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 2.1.0 (2022-07-28)

<details><summary>Packages in this release</summary>
<p>

| Package                              | Download                                                          |
| ------------------------------------ | ----------------------------------------------------------------- |
| @jbrowse/core                        | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments           | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication       |                                                                   |
| @jbrowse/plugin-bed                  | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-comparative-adapters |                                                                   |
| @jbrowse/plugin-config               | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management      | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view         |                                                                   |
| @jbrowse/plugin-hic                  |                                                                   |
| @jbrowse/plugin-legacy-jbrowse       | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-menus                |                                                                   |
| @jbrowse/plugin-sequence             | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view     |                                                                   |
| @jbrowse/plugin-svg                  | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trix                 | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants             | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle               | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/desktop                     |                                                                   |
| @jbrowse/img                         | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view  | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view    | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                         |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#3111](https://github.com/GMOD/jbrowse-components/pull/3111) Create undo
    manager in jbrowse-web and jbrowse-desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3115](https://github.com/GMOD/jbrowse-components/pull/3115) Add warning
    when dotplot renders outside of it's boundaries, and create click-and-drag
    panning of dotplot view ([@cmdcolin](https://github.com/cmdcolin))
  - [#3102](https://github.com/GMOD/jbrowse-components/pull/3102) Allow creating
    alternative "add track workflows" from within the "Add track" widget
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3043](https://github.com/GMOD/jbrowse-components/pull/3043) Create
    MultiWiggle track type, adapter, and renderers
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3113](https://github.com/GMOD/jbrowse-components/pull/3113) Improve SVG
    performance by avoiding re-render when feature is clicked
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3110](https://github.com/GMOD/jbrowse-components/pull/3110) Remove TSDX
    from plugin development tools
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3106](https://github.com/GMOD/jbrowse-components/pull/3106) Add "emphasis"
    mode for no fill/scatterplot mode in XYPlot type renderings
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3109](https://github.com/GMOD/jbrowse-components/pull/3109) Better support
    for developing plugins from within yarn 2+ workspaces (include \_\_virtual
    folder in build) ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#3095](https://github.com/GMOD/jbrowse-components/pull/3095) Add MUI
    exports to re-exports list
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3092](https://github.com/GMOD/jbrowse-components/pull/3092) Fix use of
    embedded components with vite 3.0 using tsc to compile @jbrowse/core
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#3116](https://github.com/GMOD/jbrowse-components/pull/3116) Add docs for
  multi-wiggle tracks ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 2.0.1 (2022-07-13)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#3089](https://github.com/GMOD/jbrowse-components/pull/3089) Clarify error
    message when adapter has no features
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3084](https://github.com/GMOD/jbrowse-components/pull/3084) Show a
    descriptive error if an adapter doesn't provide a sequence
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#3071](https://github.com/GMOD/jbrowse-components/pull/3071) Add ability to
    mouseover/click on synteny feature polygons in the linear synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3081](https://github.com/GMOD/jbrowse-components/pull/3081) Add ability to
    toggle gridlines on the LGV ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3088](https://github.com/GMOD/jbrowse-components/pull/3088) Fix labels
    being cut-off in SVG features by rendering feature labels on main thread
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3085](https://github.com/GMOD/jbrowse-components/pull/3085) Fix zoom to
    behavior being inaccurate with many displayed regions visible
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3082](https://github.com/GMOD/jbrowse-components/pull/3082) Fix negative
    strand CIGAR renderings on linear synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3077](https://github.com/GMOD/jbrowse-components/pull/3077) Fix crash
    opening multiple synteny track selectors launched from dotplot view
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3086](https://github.com/GMOD/jbrowse-components/pull/3086) Fix pxToBp and
    bpToPx calculations when there are many displayed regions
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 2.0.0 (2022-07-07)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3001](https://github.com/GMOD/jbrowse-components/pull/3001) Draw SNPs in
    modifications/methylation views ([@cmdcolin](https://github.com/cmdcolin))
  - [#3068](https://github.com/GMOD/jbrowse-components/pull/3068) Allow HTML in
    feature tooltips, remove react-simple-code-editor
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3065](https://github.com/GMOD/jbrowse-components/pull/3065) Allow changing
    between xyplot,line,density for linear wiggle tracks and other small fixes
    ([@cmdcolin](https://github.com/cmdcolin))
- `text-indexing`
  - [#3058](https://github.com/GMOD/jbrowse-components/pull/3058) Improve bundle
    size and code splitting on embedded builds (v2)
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`, `text-indexing`
  - [#2949](https://github.com/GMOD/jbrowse-components/pull/2949) Upgrade to MUI
    v5, mobx-state-tree v5, mobx-react v6, mobx-react v7
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3072](https://github.com/GMOD/jbrowse-components/pull/3072) Fix the
    display of inversions for MCScan alignments
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3057](https://github.com/GMOD/jbrowse-components/pull/3057) Fix export SVG
    crash on some BigWig tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#3052](https://github.com/GMOD/jbrowse-components/pull/3052) Fix negative
    value quantitative display in svg exports
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3064](https://github.com/GMOD/jbrowse-components/pull/3064) Fix opening
    link in new tab by default in feature details
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3053](https://github.com/GMOD/jbrowse-components/pull/3053) Avoid
    displaying [object Object] on deeply nested data in base feature details ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#3067](https://github.com/GMOD/jbrowse-components/pull/3067) Typescriptify
  some integration tests ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.7.11 (2022-06-22)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| jbrowse-predefined-sessions             |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#3044](https://github.com/GMOD/jbrowse-components/pull/3044) Remove
    node-canvas from @jbrowse/core dependencies
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3041](https://github.com/GMOD/jbrowse-components/pull/3041) Fix ability to
    search and load data files using lower case refName aliases
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#3042](https://github.com/GMOD/jbrowse-components/pull/3042) Add fetch with
    proxy support to jbrowse CLI ([@cmdcolin](https://github.com/cmdcolin))
  - [#3038](https://github.com/GMOD/jbrowse-components/pull/3038) Display
    coordinates in overview scalebar when no cytoband available
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3015](https://github.com/GMOD/jbrowse-components/pull/3015) Add plaintext
    bed support with BedAdapter ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#3049](https://github.com/GMOD/jbrowse-components/pull/3049) Fix ability to
  use callbacks for the linear arc renderer
  ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2831](https://github.com/GMOD/jbrowse-components/pull/2831) Update commands
  for sorting GFF3 for tabix ([@cmdcolin](https://github.com/cmdcolin))
- [#3018](https://github.com/GMOD/jbrowse-components/pull/3018) Add desktop
  specific plugin example ([@cmdcolin](https://github.com/cmdcolin))
- [#3022](https://github.com/GMOD/jbrowse-components/pull/3022) Add example
  using embedded components with next.js
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#3035](https://github.com/GMOD/jbrowse-components/pull/3035) Add
    typescripting to hierarchical track selector
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 1.7.10 (2022-06-13)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| jbrowse-predefined-sessions             |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#3025](https://github.com/GMOD/jbrowse-components/pull/3025) Add dotplot
    session spec ([@cmdcolin](https://github.com/cmdcolin))
  - [#2975](https://github.com/GMOD/jbrowse-components/pull/2975) Add simplified
    URL format for loading synteny views
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3023](https://github.com/GMOD/jbrowse-components/pull/3023) Add error
    handling in case of invalid OAuth2 configuration used.
    ([@andrzejgrzelak](https://github.com/andrzejgrzelak))
  - [#3020](https://github.com/GMOD/jbrowse-components/pull/3020) Allow choosing
    trackId when using text-index with --file with --fileId
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3016](https://github.com/GMOD/jbrowse-components/pull/3016) Allow
    whitespace separated refname,start,end type locstring
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3006](https://github.com/GMOD/jbrowse-components/pull/3006) Add string
    array configuration slot UI improvements
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2998](https://github.com/GMOD/jbrowse-components/pull/2998) Avoid
    rendering offscreen contents in pileup renderer
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3000](https://github.com/GMOD/jbrowse-components/pull/3000) Add reference
    base and correct percentage calculations to tooltip on SNPCoverage display
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2981](https://github.com/GMOD/jbrowse-components/pull/2981) Add simplified
    URL format for loading spreadsheet and SV inspector
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2990](https://github.com/GMOD/jbrowse-components/pull/2990) Use shortened
    megabases (M) display when zoomed out, and option to hide the "open track
    selector" button
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#3003](https://github.com/GMOD/jbrowse-components/pull/3003) Add ability to
    run field formatters on the feature details panel
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3017](https://github.com/GMOD/jbrowse-components/pull/3017) Add button to
    copy track config in About track dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2999](https://github.com/GMOD/jbrowse-components/pull/2999) Generate
    clickable links to track data in about track dialog
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#3005](https://github.com/GMOD/jbrowse-components/pull/3005) Use cascading
    menu helper library for track menu to avoid menu going offscreen
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#3021](https://github.com/GMOD/jbrowse-components/pull/3021) Fix mouseover
    display of read name to alignments track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#3012](https://github.com/GMOD/jbrowse-components/pull/3012) Small fix to
    rankSearchResults logic ([@cmdcolin](https://github.com/cmdcolin))
  - [#3009](https://github.com/GMOD/jbrowse-components/pull/3009) Add jsdom to
    jbrowse-img to fix --noRasterize option
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#3007](https://github.com/GMOD/jbrowse-components/pull/3007) Fix read vs
    ref dotplot view ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- [@andrzejgrzelak](https://github.com/andrzejgrzelak)

## 1.7.9 (2022-06-02)

<details><summary>Packages in this release</summary>
<p>

| Package                              | Download                                                          |
| ------------------------------------ | ----------------------------------------------------------------- |
| @jbrowse/core                        | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments           | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-comparative-adapters |                                                                   |
| @jbrowse/plugin-config               | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management      | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view         |                                                                   |
| @jbrowse/plugin-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence             | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view     |                                                                   |
| @jbrowse/plugin-variants             | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/cli                         | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                     |                                                                   |
| @jbrowse/img                         | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view  | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view    | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                         |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2991](https://github.com/GMOD/jbrowse-components/pull/2991) Use canvas2svg
    for SVG export, fixes non-rasterized usage of bezier, arcs, and more
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2483](https://github.com/GMOD/jbrowse-components/pull/2483) Add setting to
    color by query score per alignment for dotplot, support HTML in config slot
    descriptions ([@cmdcolin](https://github.com/cmdcolin))
  - [#2983](https://github.com/GMOD/jbrowse-components/pull/2983) Set
    target=\_blank by default in user HTML links
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2994](https://github.com/GMOD/jbrowse-components/pull/2994) Allow choosing
    filename for svg export ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2989](https://github.com/GMOD/jbrowse-components/pull/2989) Fix
    bezierCurveTo ponyfill on firefox ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2977](https://github.com/GMOD/jbrowse-components/pull/2977) Respect
    --indexFile option when adding VCF and BED tracks
    ([@heavywatal](https://github.com/heavywatal))
  - [#2974](https://github.com/GMOD/jbrowse-components/pull/2974) Fix track
    indexing being ignored after first add track widget usage
    ([@teresam856](https://github.com/teresam856))

#### :house: Internal

- [#2980](https://github.com/GMOD/jbrowse-components/pull/2980) Remove errors
  related to test coverage in CI ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 4

- Adam Wright ([@adamjohnwright](https://github.com/adamjohnwright))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))
- Watal M. Iwasaki ([@heavywatal](https://github.com/heavywatal))

## 1.7.8 (2022-05-20)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- [#2970](https://github.com/GMOD/jbrowse-components/pull/2970) Draw indels in
  modifications/methylation mode ([@cmdcolin](https://github.com/cmdcolin))
- [#2961](https://github.com/GMOD/jbrowse-components/pull/2961) Add more visible
  pileup mismatches when zoomed out ([@cmdcolin](https://github.com/cmdcolin))
- [#2960](https://github.com/GMOD/jbrowse-components/pull/2960) Avoid performing
  a text index search if input looks like a locstring
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2954](https://github.com/GMOD/jbrowse-components/pull/2954) Support
  in-memory GFF3 and GTF in JBrowse 1 connection
  ([@garrettjstevens](https://github.com/garrettjstevens))
- [#2947](https://github.com/GMOD/jbrowse-components/pull/2947) Optimization for
  SNPCoverageAdapter and CRAM parsing ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#2969](https://github.com/GMOD/jbrowse-components/pull/2969) Fix link on
  yeast synteny demo and fix CIGAR rendering on dotplot
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2964](https://github.com/GMOD/jbrowse-components/pull/2964) Fix crash
  displaying modifications called on softclipped regions of reads
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2965](https://github.com/GMOD/jbrowse-components/pull/2965) Fix filter
  functionality on pileup tracks ([@cmdcolin](https://github.com/cmdcolin))
- [#2953](https://github.com/GMOD/jbrowse-components/pull/2953) Fix "Open"
  button on LGV ImportForm ([@cmdcolin](https://github.com/cmdcolin))
- [#2952](https://github.com/GMOD/jbrowse-components/pull/2952) Fix read vs ref
  not finding primary alignment on certain CRAM files
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2951](https://github.com/GMOD/jbrowse-components/pull/2951) Fix viewing
  soft/hardclip indicator in some regions
  ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2946](https://github.com/GMOD/jbrowse-components/pull/2946) Small doc
  updates ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#2955](https://github.com/GMOD/jbrowse-components/pull/2955) Re-enable eslint
  autofix for prettier rules
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.7.7 (2022-05-04)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :bug: Bug Fix

- [#2941](https://github.com/GMOD/jbrowse-components/pull/2941) Fix linear read
  vs ref hanging in v1.7.5 ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2944](https://github.com/GMOD/jbrowse-components/pull/2944) Avoid stalling
    on undefined assemblyName during ref name renaming
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 1.7.6 (2022-04-26)

<details><summary>Packages in this release</summary>
<p>

| Package          | Download |
| ---------------- | -------- |
| @jbrowse/desktop |          |

</p>
</details>

#### :bug: Bug Fix

- [#2939](https://github.com/GMOD/jbrowse-components/pull/2939) Fix loading
  CRAM, TwoBit, and other modules that use @gmod/binary-parser on jbrowse
  desktop ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 1.7.5 (2022-04-26)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/text-indexing                  |                                                                   |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-jobs-management         |                                                                   |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-text-indexing           |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2885](https://github.com/GMOD/jbrowse-components/pull/2885) Reduce
    serialization overhead on alignments tracks and access feature details
    asynchronously ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2935](https://github.com/GMOD/jbrowse-components/pull/2935) Use the name
    "Read Sequence" for the read vs ref view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2916](https://github.com/GMOD/jbrowse-components/pull/2916) Add vite setup
    to our embedded component demos ([@cmdcolin](https://github.com/cmdcolin))
  - [#2927](https://github.com/GMOD/jbrowse-components/pull/2927) Optimize gtf
    by only parsing lazily per-refName
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2928](https://github.com/GMOD/jbrowse-components/pull/2928) Add
    vanillajs/script tag loading embedded components demos
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `text-indexing`
  - [#2684](https://github.com/GMOD/jbrowse-components/pull/2684) Text-indexing
    in desktop ([@teresam856](https://github.com/teresam856))

#### :bug: Bug Fix

- [#2863](https://github.com/GMOD/jbrowse-components/pull/2863) Render gene with
  CDS subfeatures properly ([@cmdcolin](https://github.com/cmdcolin))
- [#2934](https://github.com/GMOD/jbrowse-components/pull/2934) Bump @gmod/trix
  to fix prefix size calculation and searching first word in index
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.7.4 (2022-04-19)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :bug: Bug Fix

- Other
  - [#2925](https://github.com/GMOD/jbrowse-components/pull/2925) Fix embedded
    vanillaJS/script tag usage of embedded components
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2923](https://github.com/GMOD/jbrowse-components/pull/2923) Add
    babel/runtime to dependencies
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

<details><summary>Packages in this release</summary>
<p>

| Package                           | Download                                                        |
| --------------------------------- | --------------------------------------------------------------- |
| @jbrowse/img                      | https://www.npmjs.com/package/@jbrowse/img                      |
| @jbrowse/react-linear-genome-view | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view |

</p>
</details>

## 1.7.1 (2022-04-15)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :bug: Bug Fix

- `core`
  - [#2917](https://github.com/GMOD/jbrowse-components/pull/2917) Create
    tsconfig.build.json to add types to plugins/embedded components
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2914](https://github.com/GMOD/jbrowse-components/pull/2914) Manually
    polyfill fetch in @jbrowse/img ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2903](https://github.com/GMOD/jbrowse-components/pull/2903) Add download
  link for jbrowse web on downloads page
  ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 1.7.0 (2022-04-14)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| jbrowse-predefined-sessions             |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2909](https://github.com/GMOD/jbrowse-components/pull/2909) Add
    --prefixSize flag to @jbrowse/cli text-index
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2887](https://github.com/GMOD/jbrowse-components/pull/2887) Optimize
    filtering on alignments tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#2879](https://github.com/GMOD/jbrowse-components/pull/2879) Multi-level
    synteny rubberband ([@cmdcolin](https://github.com/cmdcolin))
  - [#2874](https://github.com/GMOD/jbrowse-components/pull/2874) Optimizations
    for rendering long syntenic alignments e.g. CHM13 vs GRCh38
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2872](https://github.com/GMOD/jbrowse-components/pull/2872) Better
    connection between paired-end alignments in breakpoint split view and
    optimizations ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2902](https://github.com/GMOD/jbrowse-components/pull/2902) Standardize
    heights of widgets in LGV import form
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2781](https://github.com/GMOD/jbrowse-components/pull/2781) Add floating
    labels to SVG features ([@cmdcolin](https://github.com/cmdcolin))
  - [#2875](https://github.com/GMOD/jbrowse-components/pull/2875) Make assembly
    selector remember your last selected assembly
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2860](https://github.com/GMOD/jbrowse-components/pull/2860) Avoid
    performing many peekTransferables to optimize RPC serialization
    ([@rbuels](https://github.com/rbuels))

#### :bug: Bug Fix

- Other
  - [#2908](https://github.com/GMOD/jbrowse-components/pull/2908) Fix
    AboutDialog under vite for embedded components
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2900](https://github.com/GMOD/jbrowse-components/pull/2900) Fix the 'Open
    assembly' menu item in jbrowse desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2882](https://github.com/GMOD/jbrowse-components/pull/2882) Add padding at
    the bottom of the configuration editor to help color editing popup being
    cutoff ([@cmdcolin](https://github.com/cmdcolin))
  - [#2877](https://github.com/GMOD/jbrowse-components/pull/2877) Fix strand on
    arrows in horizontally flipped mode
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2891](https://github.com/GMOD/jbrowse-components/pull/2891) Use a
    user-supplied fetchESM callback to import ESM plugins to fix 'Critical
    dependency...' errors from embedded components
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2894](https://github.com/GMOD/jbrowse-components/pull/2894) Add
  create-react-app v5 embedded component demos
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2830](https://github.com/GMOD/jbrowse-components/pull/2830) Documentation
  comparing main app with embedded components
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))

#### :house: Internal

- `core`
  - [#2904](https://github.com/GMOD/jbrowse-components/pull/2904) Use a
    user-supplied fetchCJS callback to import CJS plugins
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2891](https://github.com/GMOD/jbrowse-components/pull/2891) Use a
    user-supplied fetchESM callback to import ESM plugins to fix 'Critical
    dependency...' errors from embedded components
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2857](https://github.com/GMOD/jbrowse-components/pull/2857) Refactor and
    improve types of OffscreenCanvas shim and ponyfill
    ([@rbuels](https://github.com/rbuels))
- `__mocks__`, `core`
  - [#2905](https://github.com/GMOD/jbrowse-components/pull/2905) Use
    react-use-measure instead of react-use-dimensions
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2646](https://github.com/GMOD/jbrowse-components/pull/2646) Upgrade
    repository to use webpack 5/CRA 5 ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Robert Buels ([@rbuels](https://github.com/rbuels))

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

## 1.6.8 (2022-03-25)

<details><summary>Packages in this release</summary>
<p>

| Package                               | Download                                                          |
| ------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                         | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments            | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-breakpoint-split-view |                                                                   |
| @jbrowse/plugin-data-management       | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-linear-genome-view    | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence              | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-svg                   | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-wiggle                | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/desktop                      |                                                                   |
| @jbrowse/img                          | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view   | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view     | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                          |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2847](https://github.com/GMOD/jbrowse-components/pull/2847) Add option to
    color all the letters on all the reads to the pileup renderer
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2849](https://github.com/GMOD/jbrowse-components/pull/2849) Avoid drawing
    intron subfeatures for gene glyphs
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2835](https://github.com/GMOD/jbrowse-components/pull/2835) Hide add track
    and connection menu items when using embedded component
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#2836](https://github.com/GMOD/jbrowse-components/pull/2836) Display
    low-quality modifications in SNPCoverage renderer for MM tag
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2809](https://github.com/GMOD/jbrowse-components/pull/2809) Optimizations
    for alignments tracks and BAM parsing
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2828](https://github.com/GMOD/jbrowse-components/pull/2828) Change
    calculation for number of webworkers for web/desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2829](https://github.com/GMOD/jbrowse-components/pull/2829) Allow user to
    specify number of workers
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2775](https://github.com/GMOD/jbrowse-components/pull/2775) New SVG gene
    glyph with directional arrows ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#2852](https://github.com/GMOD/jbrowse-components/pull/2852) Fix misaligned
    features under breakpoint split view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2844](https://github.com/GMOD/jbrowse-components/pull/2844) Fix layout of
    small features without labels for SvgFeatureRenderer
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2839](https://github.com/GMOD/jbrowse-components/pull/2839) Fix the
    drawing of SNP height when the SNPCoverage track is using log scale
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2825](https://github.com/GMOD/jbrowse-components/pull/2825) Fix
    tracklabels positioning not updating in UI after user selection
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2841](https://github.com/GMOD/jbrowse-components/pull/2841) Fix alignments
    tracks loading excessive data on chromosomes where no features exist
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2829](https://github.com/GMOD/jbrowse-components/pull/2829) Allow user to
    specify number of workers
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.6.7 (2022-03-16)

<details><summary>Packages in this release</summary>
<p>

| Package                              | Download                                                          |
| ------------------------------------ | ----------------------------------------------------------------- |
| @jbrowse/plugin-alignments           | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication       |                                                                   |
| @jbrowse/plugin-comparative-adapters |                                                                   |
| @jbrowse/plugin-dotplot-view         |                                                                   |
| @jbrowse/plugin-gff3                 | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-gtf                  | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-spreadsheet-view     |                                                                   |
| @jbrowse/plugin-variants             | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle               | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/desktop                     |                                                                   |
| @jbrowse/img                         | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view  | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view    | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                         |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- [#2820](https://github.com/GMOD/jbrowse-components/pull/2820) Add optimization
  for BAM and unzip operations ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#2821](https://github.com/GMOD/jbrowse-components/pull/2821) Fixup scroll on
  wiggle tracks with trackLabels->offset
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2819](https://github.com/GMOD/jbrowse-components/pull/2819) Fix bug in
  desktop where first track gets stuck loading
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.6.6 (2022-03-15)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools          |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-comparative-adapters    |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-protein                 |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| jbrowse-predefined-sessions             |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2796](https://github.com/GMOD/jbrowse-components/pull/2796) Add
    collapsible accordion sections in configuration editor
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2791](https://github.com/GMOD/jbrowse-components/pull/2791) Add new
    coloring options for dotplot and ability to "rectangularize" dotplot view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2741](https://github.com/GMOD/jbrowse-components/pull/2741) Allow ability
    to enter a space-separated locstring to open a list of regions
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2725](https://github.com/GMOD/jbrowse-components/pull/2725) Refactor
    InternetAccounts, add standard getFetcher
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2787](https://github.com/GMOD/jbrowse-components/pull/2787) Display the
    total bp viewed in the header of the dotplot view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2767](https://github.com/GMOD/jbrowse-components/pull/2767) Wiggle and
    SNPCoverage look and feel improvements
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2746](https://github.com/GMOD/jbrowse-components/pull/2746) Add .delta and
    .chain format adapters, fix ref name aliasing in synteny/dotplot views, and
    optimize very long CIGAR string in synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2799](https://github.com/GMOD/jbrowse-components/pull/2799) Exit process
    after rendering to speed up jb2export
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2793](https://github.com/GMOD/jbrowse-components/pull/2793) Add
    abortcontroller polyfill to jbrowse-img to allow it to run under node 14
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2761](https://github.com/GMOD/jbrowse-components/pull/2761) Add a --clean
    argument to `jbrowse upgrade` to clean up old files
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2760](https://github.com/GMOD/jbrowse-components/pull/2760) Make a
    configurable refNameColumn in RefNameAliasAdapter
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2798](https://github.com/GMOD/jbrowse-components/pull/2798) Fix bug where
    web worker would sometimes be called before it was ready
    ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#2797](https://github.com/GMOD/jbrowse-components/pull/2797) Fix crash
    plotting methylation in sparse regions
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2782](https://github.com/GMOD/jbrowse-components/pull/2782) Fix display of
    cytobands when horizontally flipped
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2678](https://github.com/GMOD/jbrowse-components/pull/2678) Preserve
    double border line when using trackLabel offset and use smaller gap between
    snpcoverage and reads ([@cmdcolin](https://github.com/cmdcolin))
  - [#2774](https://github.com/GMOD/jbrowse-components/pull/2774) Fix
    overwriting broken symlink with --force in add-track CLI
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2773](https://github.com/GMOD/jbrowse-components/pull/2773) Fix using
    global stats autoscale on wiggle tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2766](https://github.com/GMOD/jbrowse-components/pull/2766) Add a check
    for empty content blocks to fix rare empty stats estimation
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2804](https://github.com/GMOD/jbrowse-components/pull/2804) Add note about
  additional pre-requisites to README ([@cmdcolin](https://github.com/cmdcolin))
- [#2762](https://github.com/GMOD/jbrowse-components/pull/2762) Add bookmark
  widget docs to user guide ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#2813](https://github.com/GMOD/jbrowse-components/pull/2813) Create
  codeVerifierPKCE only when needed
  ([@garrettjstevens](https://github.com/garrettjstevens))
- [#2808](https://github.com/GMOD/jbrowse-components/pull/2808) Polyfill
  window.crypto.getRandomValues in tests
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.6.5 (2022-02-18)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- [#2736](https://github.com/GMOD/jbrowse-components/pull/2736) Add better
  display of error state in dotplot view and load gzipped PAF files
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2705](https://github.com/GMOD/jbrowse-components/pull/2705) Increase
  admin-server payload limit
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#2758](https://github.com/GMOD/jbrowse-components/pull/2758) Use
    VariantTrack for plaintext VCF type
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2738](https://github.com/GMOD/jbrowse-components/pull/2738) Add better
    catch for XS and TS tag detection from CRAM
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2733](https://github.com/GMOD/jbrowse-components/pull/2733) Use sparse
    array for alignments coverage to fix bug viewing large sparse regions
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2734](https://github.com/GMOD/jbrowse-components/pull/2734) Use node fetch
    instead of follow-redirects in cli
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2726](https://github.com/GMOD/jbrowse-components/pull/2726) Handle .bgz
    file extension for text-index ([@cmdcolin](https://github.com/cmdcolin))
  - [#2727](https://github.com/GMOD/jbrowse-components/pull/2727) Add engines 16
    to @jbrowse/img ([@cmdcolin](https://github.com/cmdcolin))
  - [#2723](https://github.com/GMOD/jbrowse-components/pull/2723) Make jbrowse
    desktop more robust to errors when reading recent sessions file
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2715](https://github.com/GMOD/jbrowse-components/pull/2715) Change
    --target to --root for jbrowse CLI admin-server
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2757](https://github.com/GMOD/jbrowse-components/pull/2757) Fix type
    confusion with stats estimation causing BAM files to fail byte size
    calculation ([@cmdcolin](https://github.com/cmdcolin))
  - [#2750](https://github.com/GMOD/jbrowse-components/pull/2750) Add
    bezierCurveTo to offscreen canvas ponyfill to fix sashimi arcs rendering in
    alignments track in webkit and firefox
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2719](https://github.com/GMOD/jbrowse-components/pull/2719) Avoid
    uninitialized state during stats estimation
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2707](https://github.com/GMOD/jbrowse-components/pull/2707) Fix ability to
    use authenticated assembly files
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2695](https://github.com/GMOD/jbrowse-components/pull/2695) Fix disabled
    state on the linear genome view track labels dropdown menu
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2716](https://github.com/GMOD/jbrowse-components/pull/2716) Update to node12
  requirement for @jbrowse/cli ([@cmdcolin](https://github.com/cmdcolin))
- [#2605](https://github.com/GMOD/jbrowse-components/pull/2605) Developer guide
  reorganization and create new API document
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2664](https://github.com/GMOD/jbrowse-components/pull/2664) Use babel
    config from core in root
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Sebastian Benjamin ([@hextraza](https://github.com/hextraza))

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-linear-genome-view  | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

<details><summary>Packages in this release</summary>
<p>

| Package      | Download                                   |
| ------------ | ------------------------------------------ |
| @jbrowse/cli | https://www.npmjs.com/package/@jbrowse/cli |

</p>
</details>

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

## 1.6.0 (2022-01-28)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2679](https://github.com/GMOD/jbrowse-components/pull/2679) Optimizations
    and usability improvements to synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2677](https://github.com/GMOD/jbrowse-components/pull/2677) Save user
    settings from LGV ([@cmdcolin](https://github.com/cmdcolin))
  - [#2571](https://github.com/GMOD/jbrowse-components/pull/2571) Add stats
    estimation to JB2 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2666](https://github.com/GMOD/jbrowse-components/pull/2666) Add option to
    display curved lines and to square the dotplot and synteny views
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2672](https://github.com/GMOD/jbrowse-components/pull/2672) Optimize dot
    plot rendering ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2680](https://github.com/GMOD/jbrowse-components/pull/2680) Improve error
    handling on jbrowse desktop open sequence dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2670](https://github.com/GMOD/jbrowse-components/pull/2670) Add mashmap
    PAF support ([@cmdcolin](https://github.com/cmdcolin))
  - [#2659](https://github.com/GMOD/jbrowse-components/pull/2659) Draw size of
    deletion on reads in alignments track
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#2165](https://github.com/GMOD/jbrowse-components/pull/2165) Add ability to
    create new sessions solely from a "session spec" in the URL
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2688](https://github.com/GMOD/jbrowse-components/pull/2688) Fix
    adapterType dropdown in add track widget
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2654](https://github.com/GMOD/jbrowse-components/pull/2654) Fix broken
    @jbrowse/img by adding babel config back to core
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2686](https://github.com/GMOD/jbrowse-components/pull/2686) Use
    path.resolve to fix --load symlink in jbrowse CLI
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2660](https://github.com/GMOD/jbrowse-components/pull/2660) Fix custom
    glyphs to apply to features without subfeatures
    ([@bbimber](https://github.com/bbimber))
  - [#2652](https://github.com/GMOD/jbrowse-components/pull/2652) Fix "module"
    of embedded React views
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :memo: Documentation

- [#2663](https://github.com/GMOD/jbrowse-components/pull/2663) Add
  documentation for URL params and session spec
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2655](https://github.com/GMOD/jbrowse-components/pull/2655) Add link to PAG
  2022 youtube tutorial on demos page and course archive
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2649](https://github.com/GMOD/jbrowse-components/pull/2649) Add Cypress
    test of package that uses embedded components
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2648](https://github.com/GMOD/jbrowse-components/pull/2648) Avoid
    console.warns in tests due to writing to MST nodes that are not alive
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2657](https://github.com/GMOD/jbrowse-components/pull/2657) Fix hot reload
    using yarn resolution on react-error-overlay
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- [@bbimber](https://github.com/bbimber)

## 1.6.0 (2022-01-28)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2679](https://github.com/GMOD/jbrowse-components/pull/2679) Optimizations
    and usability improvements to synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2677](https://github.com/GMOD/jbrowse-components/pull/2677) Save user
    settings from LGV ([@cmdcolin](https://github.com/cmdcolin))
  - [#2571](https://github.com/GMOD/jbrowse-components/pull/2571) Add stats
    estimation to JB2 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2666](https://github.com/GMOD/jbrowse-components/pull/2666) Add option to
    display curved lines and to square the dotplot and synteny views
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2672](https://github.com/GMOD/jbrowse-components/pull/2672) Optimize dot
    plot rendering ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2680](https://github.com/GMOD/jbrowse-components/pull/2680) Improve error
    handling on jbrowse desktop open sequence dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2670](https://github.com/GMOD/jbrowse-components/pull/2670) Add mashmap
    PAF support ([@cmdcolin](https://github.com/cmdcolin))
  - [#2659](https://github.com/GMOD/jbrowse-components/pull/2659) Draw size of
    deletion on reads in alignments track
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#2165](https://github.com/GMOD/jbrowse-components/pull/2165) Add ability to
    create new sessions solely from a "session spec" in the URL
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2688](https://github.com/GMOD/jbrowse-components/pull/2688) Fix
    adapterType dropdown in add track widget
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2654](https://github.com/GMOD/jbrowse-components/pull/2654) Fix broken
    @jbrowse/img by adding babel config back to core
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2686](https://github.com/GMOD/jbrowse-components/pull/2686) Use
    path.resolve to fix --load symlink in jbrowse CLI
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2660](https://github.com/GMOD/jbrowse-components/pull/2660) Fix custom
    glyphs to apply to features without subfeatures
    ([@bbimber](https://github.com/bbimber))
  - [#2652](https://github.com/GMOD/jbrowse-components/pull/2652) Fix "module"
    of embedded React views
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :memo: Documentation

- [#2663](https://github.com/GMOD/jbrowse-components/pull/2663) Add
  documentation for URL params and session spec
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2655](https://github.com/GMOD/jbrowse-components/pull/2655) Add link to PAG
  2022 youtube tutorial on demos page and course archive
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2649](https://github.com/GMOD/jbrowse-components/pull/2649) Add Cypress
    test of package that uses embedded components
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2648](https://github.com/GMOD/jbrowse-components/pull/2648) Avoid
    console.warns in tests due to writing to MST nodes that are not alive
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2657](https://github.com/GMOD/jbrowse-components/pull/2657) Fix hot reload
    using yarn resolution on react-error-overlay
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- [@bbimber](https://github.com/bbimber)

## 1.6.0 (2022-01-28)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2679](https://github.com/GMOD/jbrowse-components/pull/2679) Optimizations
    and usability improvements to synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2677](https://github.com/GMOD/jbrowse-components/pull/2677) Save user
    settings from LGV ([@cmdcolin](https://github.com/cmdcolin))
  - [#2571](https://github.com/GMOD/jbrowse-components/pull/2571) Add stats
    estimation to JB2 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2666](https://github.com/GMOD/jbrowse-components/pull/2666) Add option to
    display curved lines and to square the dotplot and synteny views
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2672](https://github.com/GMOD/jbrowse-components/pull/2672) Optimize dot
    plot rendering ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2680](https://github.com/GMOD/jbrowse-components/pull/2680) Improve error
    handling on jbrowse desktop open sequence dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2670](https://github.com/GMOD/jbrowse-components/pull/2670) Add mashmap
    PAF support ([@cmdcolin](https://github.com/cmdcolin))
  - [#2659](https://github.com/GMOD/jbrowse-components/pull/2659) Draw size of
    deletion on reads in alignments track
    ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#2165](https://github.com/GMOD/jbrowse-components/pull/2165) Add ability to
    create new sessions solely from a "session spec" in the URL
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2688](https://github.com/GMOD/jbrowse-components/pull/2688) Fix
    adapterType dropdown in add track widget
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2654](https://github.com/GMOD/jbrowse-components/pull/2654) Fix broken
    @jbrowse/img by adding babel config back to core
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2686](https://github.com/GMOD/jbrowse-components/pull/2686) Use
    path.resolve to fix --load symlink in jbrowse CLI
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2660](https://github.com/GMOD/jbrowse-components/pull/2660) Fix custom
    glyphs to apply to features without subfeatures
    ([@bbimber](https://github.com/bbimber))
  - [#2652](https://github.com/GMOD/jbrowse-components/pull/2652) Fix "module"
    of embedded React views
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :memo: Documentation

- [#2663](https://github.com/GMOD/jbrowse-components/pull/2663) Add
  documentation for URL params and session spec
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2655](https://github.com/GMOD/jbrowse-components/pull/2655) Add link to PAG
  2022 youtube tutorial on demos page and course archive
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2649](https://github.com/GMOD/jbrowse-components/pull/2649) Add Cypress
    test of package that uses embedded components
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2648](https://github.com/GMOD/jbrowse-components/pull/2648) Avoid
    console.warns in tests due to writing to MST nodes that are not alive
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2657](https://github.com/GMOD/jbrowse-components/pull/2657) Fix hot reload
    using yarn resolution on react-error-overlay
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- [@bbimber](https://github.com/bbimber)

## 1.5.9 (2022-01-13)

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

#### :bug: Bug Fix

- [#2645](https://github.com/GMOD/jbrowse-components/pull/2645) Fix core by not
  using absolute runtime in babel
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 1

- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

## 1.5.7 (2022-01-13)

<details><summary>Packages in this release</summary>
<p>

| Package                      | Download |
| ---------------------------- | -------- |
| @jbrowse/plugin-dotplot-view |          |
| @jbrowse/desktop             |          |
| @jbrowse/web                 |          |

</p>
</details>

#### :rocket: Enhancement

- [#2632](https://github.com/GMOD/jbrowse-components/pull/2632) Add vertical
  resize handle to dotplot view ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 1

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))

## 1.5.6 (2022-01-12)

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-linear-genome-view  | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2629](https://github.com/GMOD/jbrowse-components/pull/2629) Add ability to
    get parent feature in jexl syntax with either parent(feature) or
    get(feature,'parent') ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                       | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/desktop                    |                                                                   |
| @jbrowse/img                        | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                        |                                                                   |

</p>
</details>

## 1.5.4 (2022-01-07)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools          |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2601](https://github.com/GMOD/jbrowse-components/pull/2601) Allow opening
    multiple sequences from the desktop start screen
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2623](https://github.com/GMOD/jbrowse-components/pull/2623) Adjust label
    width on base feature detail to enforce better alignment
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))

#### :bug: Bug Fix

- Other
  - [#2612](https://github.com/GMOD/jbrowse-components/pull/2612) Fix ability to
    remove plugins ([@cmdcolin](https://github.com/cmdcolin))
  - [#2622](https://github.com/GMOD/jbrowse-components/pull/2622) Fix GUI color
    editor rgba string format
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2607](https://github.com/GMOD/jbrowse-components/pull/2607) Fix wiggle
    tooltip crash on non-numerical inputs
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2626](https://github.com/GMOD/jbrowse-components/pull/2626) Fix bad layout
    resulting in features being unable to be clicked in embedded mode
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2595](https://github.com/GMOD/jbrowse-components/pull/2595) Use some newly
    available TypeScript types
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2576](https://github.com/GMOD/jbrowse-components/pull/2576) Use TypeScript
    parameter properties
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 3

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.5.3 (2021-12-21)

<details><summary>Packages in this release</summary>
<p>

| Package                    | Download                                                 |
| -------------------------- | -------------------------------------------------------- |
| @jbrowse/development-tools | https://www.npmjs.com/package/@jbrowse/development-tools |

</p>
</details>

#### :bug: Bug Fix

- `development-tools`
  - [#2600](https://github.com/GMOD/jbrowse-components/pull/2600) Fix broken
    published build of jbrowse/development-tools
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 1

- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.5.2 (2021-12-20)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools          |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-arc                     |                                                                   |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2579](https://github.com/GMOD/jbrowse-components/pull/2579) Add help text
    and help dialog for the RefNameAutocomplete
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2553](https://github.com/GMOD/jbrowse-components/pull/2553) Add
    sashimi-style arcs for RNA-seq type skips on SNPCoverage display
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2552](https://github.com/GMOD/jbrowse-components/pull/2552) Change border
    on non-cytoband OverviewScaleBar visible region back to blue and cytoband
    OverviewScaleBar to a little lighter fill
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2509](https://github.com/GMOD/jbrowse-components/pull/2509) Implement prop
    interface for providing arbitrary user-defined glyphs to SvgFeatureRenderer
    ([@hextraza](https://github.com/hextraza))
  - [#2485](https://github.com/GMOD/jbrowse-components/pull/2485) Only use one
    button, "Go", in text search ambiguous results dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2501](https://github.com/GMOD/jbrowse-components/pull/2501) Add a tooltip
    to desktop session path so you can see the full path if it's cut off
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2580](https://github.com/GMOD/jbrowse-components/pull/2580) Make core
    snackbar notifications module with auto-dismissing info/success level
    notifications ([@cmdcolin](https://github.com/cmdcolin))
  - [#2534](https://github.com/GMOD/jbrowse-components/pull/2534) New display
    type for drawing arcs
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#2590](https://github.com/GMOD/jbrowse-components/pull/2590) Add more
    exports that can be used by plugins
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2578](https://github.com/GMOD/jbrowse-components/pull/2578) Add layouts
    code to core re-exports
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2523](https://github.com/GMOD/jbrowse-components/pull/2523) Performance
    optimizations for alignments tracks, particularly those with many short
    reads ([@cmdcolin](https://github.com/cmdcolin))
  - [#2500](https://github.com/GMOD/jbrowse-components/pull/2500) Add
    RenderProps to core/pluggableElementTypes export
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`, `development-tools`
  - [#2487](https://github.com/GMOD/jbrowse-components/pull/2487) Add support
    for additional types of plugin formats (commonjs, esm) to allow access to
    node modules on jbrowse desktop
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#2594](https://github.com/GMOD/jbrowse-components/pull/2594) Fix infinite
    loop bug while searching certain strings and handle multi-word searches
    better ([@cmdcolin](https://github.com/cmdcolin))
  - [#2589](https://github.com/GMOD/jbrowse-components/pull/2589) Fix occasional
    failures observed from running text-index command
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2583](https://github.com/GMOD/jbrowse-components/pull/2583) Fix for
    alignments track base modifications display regarding skipped bases on Mm
    tag ([@cmdcolin](https://github.com/cmdcolin))
  - [#2556](https://github.com/GMOD/jbrowse-components/pull/2556) Fix ability to
    access BigWig tracks on http basic auth for some cases
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2577](https://github.com/GMOD/jbrowse-components/pull/2577) Fix ability to
    use --indexFile on VCF/GFF tabix and CRAM files and add plaintext VCF, GFF,
    GTF support to add-track CLI ([@cmdcolin](https://github.com/cmdcolin))
  - [#2521](https://github.com/GMOD/jbrowse-components/pull/2521) Fix ability to
    search for tracks with parentheses in tracklist
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2512](https://github.com/GMOD/jbrowse-components/pull/2512) Fix [object
    Window] issue in alignment read vs reference dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#2499](https://github.com/GMOD/jbrowse-components/pull/2499) Add missing
    dependency to CLI ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2585](https://github.com/GMOD/jbrowse-components/pull/2585) Fix ability to
    use "Color by methylation" on files that require refname renaming
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2517](https://github.com/GMOD/jbrowse-components/pull/2517) Remove
    aborting on adapter loading process to fix some tracks getting stuck in
    infinite loading state ([@cmdcolin](https://github.com/cmdcolin))
  - [#2564](https://github.com/GMOD/jbrowse-components/pull/2564) Start looking
    for parents with parent, not self in findParentThat
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2563](https://github.com/GMOD/jbrowse-components/pull/2563) Restore
    ability to load plugins from relative URL
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2533](https://github.com/GMOD/jbrowse-components/pull/2533) Fix drawer
    widget minimized button being unclickable when overlapping with a view
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2522](https://github.com/GMOD/jbrowse-components/pull/2522) Add circular
  genome view storybook ([@cmdcolin](https://github.com/cmdcolin))
- [#2508](https://github.com/GMOD/jbrowse-components/pull/2508) Update docs for
  embedded components ([@teresam856](https://github.com/teresam856))
- [#2495](https://github.com/GMOD/jbrowse-components/pull/2495) Improve
  organization on docs landing page ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2597](https://github.com/GMOD/jbrowse-components/pull/2597) Fix flaky
    tests related to auth and canvas image snapshots
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2504](https://github.com/GMOD/jbrowse-components/pull/2504) Spreadsheet
    change jbrequire to es6 imports ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 6

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))
- Sebastian Benjamin ([@hextraza](https://github.com/hextraza))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.5.1 (2021-11-04)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-gtf                     | https://www.npmjs.com/package/@jbrowse/plugin-gtf                 |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| jbrowse-predefined-sessions             |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2488](https://github.com/GMOD/jbrowse-components/pull/2488) Improve
    usability of the search result autocomplete when typing in via keyboard
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2267](https://github.com/GMOD/jbrowse-components/pull/2267) Add cytoband
    to overview scale bar in LGV ([@cmdcolin](https://github.com/cmdcolin))
  - [#2447](https://github.com/GMOD/jbrowse-components/pull/2447) Drawer widget
    tooltips and use position: fixed on fab
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2299](https://github.com/GMOD/jbrowse-components/pull/2299) Add new
    pluggable element type and properties to adapter type for registering
    adapter association with 'add track' workflow
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Other
  - [#2484](https://github.com/GMOD/jbrowse-components/pull/2484) "Add custom
    plugin" dialog improvements ([@cmdcolin](https://github.com/cmdcolin))
  - [#2389](https://github.com/GMOD/jbrowse-components/pull/2389) Create
    plaintext GtfAdapter in plugins/gtf
    ([@teresam856](https://github.com/teresam856))
  - [#2443](https://github.com/GMOD/jbrowse-components/pull/2443) Support
    plaintext fasta on desktop by dynamically creating a FAI file on the fly
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2479](https://github.com/GMOD/jbrowse-components/pull/2479) Allow gzipped
    Gff3Adapter input and use 512MB limit
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2467](https://github.com/GMOD/jbrowse-components/pull/2467) Set default
    session dialog redesign ([@cmdcolin](https://github.com/cmdcolin))
  - [#2461](https://github.com/GMOD/jbrowse-components/pull/2461) Add assembly
    manager back into tools menu on jbrowse-desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2442](https://github.com/GMOD/jbrowse-components/pull/2442) Add simple
    loading screen for LGV ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#2494](https://github.com/GMOD/jbrowse-components/pull/2494) Add polyfill
    for text-index compatibility with node 10
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2492](https://github.com/GMOD/jbrowse-components/pull/2492) Fix ability to
    open breakpoint split view from a BEDPE row in SV inspector
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2480](https://github.com/GMOD/jbrowse-components/pull/2480) Fix refName
    renaming on VcfAdapter for files that don't have ##contig lines
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2469](https://github.com/GMOD/jbrowse-components/pull/2469) Fix embedded
    crash when opening dialogs
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2451](https://github.com/GMOD/jbrowse-components/pull/2451) Fix issue with
    intermittent text-index failures and improve speed
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2439](https://github.com/GMOD/jbrowse-components/pull/2439) Fix adding
    plugins on desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#2426](https://github.com/GMOD/jbrowse-components/pull/2426) Fix CLI
    create/upgrade failing to find the latest release
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2457](https://github.com/GMOD/jbrowse-components/pull/2457) Fix linear
    synteny view import form failure ([@cmdcolin](https://github.com/cmdcolin))
  - [#2444](https://github.com/GMOD/jbrowse-components/pull/2444) Fix crash when
    chromSizesLocation not specified when loading TwoBitAdapter in GUI
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2446](https://github.com/GMOD/jbrowse-components/pull/2446) Improve some CLI
  --help messages ([@cmdcolin](https://github.com/cmdcolin))
- [#2437](https://github.com/GMOD/jbrowse-components/pull/2437) Add example of
  defining and using a plugin with the embedded component
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2430](https://github.com/GMOD/jbrowse-components/pull/2430) Website optimize
  for less layout shift ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2445](https://github.com/GMOD/jbrowse-components/pull/2445) Create core
    snapshot error message component ([@cmdcolin](https://github.com/cmdcolin))
  - [#2288](https://github.com/GMOD/jbrowse-components/pull/2288) Add extra
    re-exports for default modules
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 4

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.5.0 (2021-10-18)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-authentication          |                                                                   |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3                |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-menus                   |                                                                   |
| @jbrowse/plugin-rdf                     |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-sv-inspector            |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trackhub-registry       |                                                                   |
| @jbrowse/plugin-trix                    | https://www.npmjs.com/package/@jbrowse/plugin-trix                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/img                            | https://www.npmjs.com/package/@jbrowse/img                        |
| jbrowse-predefined-sessions             |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2413](https://github.com/GMOD/jbrowse-components/pull/2413) Bundle size
    savings ([@cmdcolin](https://github.com/cmdcolin))
  - [#2390](https://github.com/GMOD/jbrowse-components/pull/2390) Support plain
    text (non-tabix'ed) GFF files with new Gff3Adapter
    ([@teresam856](https://github.com/teresam856))
  - [#2384](https://github.com/GMOD/jbrowse-components/pull/2384) Allow docking
    the drawer on the left side of the screen
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2387](https://github.com/GMOD/jbrowse-components/pull/2387) Add bulk
    delete of sessions on jbrowse-desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2279](https://github.com/GMOD/jbrowse-components/pull/2279) Add ability to
    access authenticated resources using pluggable internet accounts framework
    ([@peterkxie](https://github.com/peterkxie))
- Other
  - [#2388](https://github.com/GMOD/jbrowse-components/pull/2388) Create
    "quickstart list" on jbrowse-desktop which users can add to
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2385](https://github.com/GMOD/jbrowse-components/pull/2385) Ensure all
    dependencies are properly specified in package.json files using
    eslint-plugin-import ([@cmdcolin](https://github.com/cmdcolin))
  - [#2373](https://github.com/GMOD/jbrowse-components/pull/2373) Add auto
    update functionality for jbrowse-desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2369](https://github.com/GMOD/jbrowse-components/pull/2369) Add tooltip
    with track description to track selector
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2258](https://github.com/GMOD/jbrowse-components/pull/2258) Update
    admin-server to accept value from ?config= so that multiple configs could be
    edited ([@cmdcolin](https://github.com/cmdcolin))
  - [#2321](https://github.com/GMOD/jbrowse-components/pull/2321) Add show
    descriptions toggle box to most feature tracks
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#2355](https://github.com/GMOD/jbrowse-components/pull/2355) Allow prefix
    and exact matches jb1 text search ([@cmdcolin](https://github.com/cmdcolin))
  - [#2348](https://github.com/GMOD/jbrowse-components/pull/2348) Fix ability to
    use JB1 backcompat text search adapter
    ([@teresam856](https://github.com/teresam856))
  - [#2322](https://github.com/GMOD/jbrowse-components/pull/2322) Fix install
    plugin workflow and error handling on desktop, update to electron 15
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2329](https://github.com/GMOD/jbrowse-components/pull/2329) Fix bugs
    preventing embedded circular genome view from rendering in some
    circumstances ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2352](https://github.com/GMOD/jbrowse-components/pull/2352) Better
    keyboard navigations on text search autocomplete component
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2332](https://github.com/GMOD/jbrowse-components/pull/2332) Fix ability to
    use LocalFile on nodejs-based apps e.g. @jbrowse/img
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2407](https://github.com/GMOD/jbrowse-components/pull/2407) Update website
  for jbrowse-desktop release
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- [#2328](https://github.com/GMOD/jbrowse-components/pull/2328) Use ../ for all
  doc links and use trailing slash to fix links
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#2382](https://github.com/GMOD/jbrowse-components/pull/2382) Export
    RefNameAutocomplete and ViewModel from LinearGenomeView for downstream usage
    ([@hextraza](https://github.com/hextraza))
  - [#2336](https://github.com/GMOD/jbrowse-components/pull/2336) Add
    jbrowse-img to monorepo ([@cmdcolin](https://github.com/cmdcolin))
  - [#2324](https://github.com/GMOD/jbrowse-components/pull/2324) Remove unused
    wrapForRpc functionality ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2379](https://github.com/GMOD/jbrowse-components/pull/2379) Bump
    typescript to 4.4.3 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2363](https://github.com/GMOD/jbrowse-components/pull/2363) Add some
    typescripting of some MST models and components
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2351](https://github.com/GMOD/jbrowse-components/pull/2351) Use main
    "module" field instead of "browser" from dependency package json files
    electron builds ([@cmdcolin](https://github.com/cmdcolin))
  - [#2323](https://github.com/GMOD/jbrowse-components/pull/2323) Remove session
    related menu items from jbrowse-desktop
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 6

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))
- Sebastian Benjamin ([@hextraza](https://github.com/hextraza))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.4.4 (2021-09-14)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config              |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse      |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                 |
| @jbrowse/plugin-trix                    |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2287](https://github.com/GMOD/jbrowse-components/pull/2287) Use
    react-popper to reduce tooltip lag on pages with many elements
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2294](https://github.com/GMOD/jbrowse-components/pull/2294) Don't rely on
    SVTYPE=BND for breakend split view options and thicker mouseover chords on
    circular views ([@cmdcolin](https://github.com/cmdcolin))
  - [#2272](https://github.com/GMOD/jbrowse-components/pull/2272) Auto adjust
    box RefNameAutocomplete width based on refName length
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2243](https://github.com/GMOD/jbrowse-components/pull/2243) Import
    bookmarks functionality for grid bookmark widget
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2247](https://github.com/GMOD/jbrowse-components/pull/2247) New
    jbrowse-desktop start screen design
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2254](https://github.com/GMOD/jbrowse-components/pull/2254) Better error
    reporting from web worker and chrom sizes adapter errors
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1881](https://github.com/GMOD/jbrowse-components/pull/1881) Add new text
    searching functionality to core, with `jbrowse text-index` CLI command to
    generate trix index ([@teresam856](https://github.com/teresam856))

#### :bug: Bug Fix

- `core`
  - [#2320](https://github.com/GMOD/jbrowse-components/pull/2320) Fix issue
    where add track widget doesn't infer adapters on second usage
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2250](https://github.com/GMOD/jbrowse-components/pull/2250) Prevent the
    ToggleButton for the FileSelector toggling to local file when only URL
    should be available ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2309](https://github.com/GMOD/jbrowse-components/pull/2309) Fix mouseover
    selection appearing across unrelated blocks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2283](https://github.com/GMOD/jbrowse-components/pull/2283) Fix ability
    for the variant detail panel to create breakpoint split view for <TRA>
    elements ([@cmdcolin](https://github.com/cmdcolin))
  - [#2268](https://github.com/GMOD/jbrowse-components/pull/2268) Fix
    autocomplete height on small displays
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2300](https://github.com/GMOD/jbrowse-components/pull/2300) Release
  announcement draft v1.4.0 ([@teresam856](https://github.com/teresam856))
- [#2310](https://github.com/GMOD/jbrowse-components/pull/2310) Add cancer demos
  to the demos page on website ([@cmdcolin](https://github.com/cmdcolin))
- [#2253](https://github.com/GMOD/jbrowse-components/pull/2253) Add note about
  legacy-peer-deps to embedded component readme
  ([@cmdcolin](https://github.com/cmdcolin))
- [#2262](https://github.com/GMOD/jbrowse-components/pull/2262) Add more MDX
  documentation pages to @jbrowse/react-linear-genome-view storybooks
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#2263](https://github.com/GMOD/jbrowse-components/pull/2263) Force publish
  all packages on release ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))
- [@Akusem](https://github.com/Akusem)

## 1.4.3

Failed NPM upload, partial release

## 1.4.2

Failed NPM upload, partial release

## 1.4.1

Broken releases missing some packages

## 1.4.0

Broken releases missing some packages

## 1.3.5 (2021-08-23)

<details><summary>Packages in this release</summary>
<p>

| Package                             | Download                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/react-circular-genome-view | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view   | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |

</p>
</details>

## 1.3.4 (2021-08-23)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                          |
| --------------------------------------- | ----------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                       |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments          |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                 |
| @jbrowse/plugin-breakpoint-split-view   |                                                                   |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view       |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management     |
| @jbrowse/plugin-dotplot-view            |                                                                   |
| @jbrowse/plugin-grid-bookmark           | https://www.npmjs.com/package/@jbrowse/plugin-grid-bookmark       |
| @jbrowse/plugin-hic                     |                                                                   |
| @jbrowse/plugin-linear-comparative-view |                                                                   |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view  |
| @jbrowse/plugin-lollipop                |                                                                   |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence            |
| @jbrowse/plugin-spreadsheet-view        |                                                                   |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants            |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle              |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                        |
| @jbrowse/desktop                        |                                                                   |
| @jbrowse/react-circular-genome-view     | https://www.npmjs.com/package/@jbrowse/react-circular-genome-view |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view   |
| @jbrowse/web                            |                                                                   |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2163](https://github.com/GMOD/jbrowse-components/pull/2163) Add new
    embeddable React Circular Genome View
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2229](https://github.com/GMOD/jbrowse-components/pull/2229) Use
    extendPluggableElement for context menu items
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2233](https://github.com/GMOD/jbrowse-components/pull/2233) Add optional
    chromSizes config slot to TwoBitAdapter to speed up loading of TwoBit files
    with many refseqs ([@cmdcolin](https://github.com/cmdcolin))
  - [#2199](https://github.com/GMOD/jbrowse-components/pull/2199) Make the BED
    parser not interpret general tab delimited data as BED12
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2241](https://github.com/GMOD/jbrowse-components/pull/2241) Restore
    previous window location when re-opening on desktop
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2203](https://github.com/GMOD/jbrowse-components/pull/2203) Add a helpful
    message if there is a 404 on config.json error
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2204](https://github.com/GMOD/jbrowse-components/pull/2204) Hide reads
    with unmapped flag by default in alignments tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2198](https://github.com/GMOD/jbrowse-components/pull/2198) Add better
    inversion visualization to read vs reference visualizations
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2154](https://github.com/GMOD/jbrowse-components/pull/2154) Add UMD build
    of react-linear-genome-view for plain-js use
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2236](https://github.com/GMOD/jbrowse-components/pull/2236) Detect
    assembly loading error and encapsulate error instead of failing at app level
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2029](https://github.com/GMOD/jbrowse-components/pull/2029) Polish desktop
    builds ([@elliothershberg](https://github.com/elliothershberg))
  - [#2140](https://github.com/GMOD/jbrowse-components/pull/2140) New core
    plugin that adds a "bookmarked regions" list widget, new extension points
    system ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- `core`
  - [#2245](https://github.com/GMOD/jbrowse-components/pull/2245) Fix missing
    regenerator runtime dependency in core
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2202](https://github.com/GMOD/jbrowse-components/pull/2202) Fixed a crash
    when an incompatible adapter is selected for provided data in 'open track'
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#2197](https://github.com/GMOD/jbrowse-components/pull/2197) Fix handle
    leak for killed worker checker ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2208](https://github.com/GMOD/jbrowse-components/pull/2208) Fix issue
    where collapsed categories were not remembered after toggling a track
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2192](https://github.com/GMOD/jbrowse-components/pull/2192) Update Linear
  Genome View embedding docs
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### :house: Internal

- `core`
  - [#2057](https://github.com/GMOD/jbrowse-components/pull/2057) Use idMaker
    for dataAdapterCache key for faster FromConfigAdapter performance
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2231](https://github.com/GMOD/jbrowse-components/pull/2231) Export
    offscreenCanvasUtils ([@cmdcolin](https://github.com/cmdcolin))
  - [#2226](https://github.com/GMOD/jbrowse-components/pull/2226) Use
    superRenderProps and superTrackMenuItems for better simulated inheritance
    model ([@cmdcolin](https://github.com/cmdcolin))
  - [#1874](https://github.com/GMOD/jbrowse-components/pull/1874) Add aborting
    to CoreGetFeatures rpcManager call
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2232](https://github.com/GMOD/jbrowse-components/pull/2232) Remove
    filtering display type from core ([@cmdcolin](https://github.com/cmdcolin))
  - [#2234](https://github.com/GMOD/jbrowse-components/pull/2234) Add rootModel
    setError on jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 4

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.3.3 (2021-08-02)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse     |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2127](https://github.com/GMOD/jbrowse-components/pull/2127) Add example
    dataset for COLO829 ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2141](https://github.com/GMOD/jbrowse-components/pull/2141) Update to
    @material-ui/core@4.12.2 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2126](https://github.com/GMOD/jbrowse-components/pull/2126) Allow opening
    plaintext .vcf files from the "Add track" workflow
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#2159](https://github.com/GMOD/jbrowse-components/pull/2159) Stop local
    storage quota-exceeded errors preventing the app from starting
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2161](https://github.com/GMOD/jbrowse-components/pull/2161) Remove outline
    from clicking on SVG chord tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#2157](https://github.com/GMOD/jbrowse-components/pull/2157) Fix rendering
    of negative strand alignment modifications/methylation
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2131](https://github.com/GMOD/jbrowse-components/pull/2131) Fix
    mouseovers/click handlers after "force load" button pressed
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2128](https://github.com/GMOD/jbrowse-components/pull/2128) Fix using the
    "Color by modifications" setting on files that need ref renaming
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2115](https://github.com/GMOD/jbrowse-components/pull/2115) Fix bug where
    sometimes plugin could not be removed from UI
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2119](https://github.com/GMOD/jbrowse-components/pull/2119) Fix loading
    indicator on the reference sequence selector getting stuck
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2101](https://github.com/GMOD/jbrowse-components/pull/2101) Fix behavior
    of the end-of-list indicator in refNameAutocomplete to always display as a
    disabled item ([@teresam856](https://github.com/teresam856))

#### :house: Internal

- Other
  - [#2152](https://github.com/GMOD/jbrowse-components/pull/2152) Remove
    storybook symlink workaround
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2099](https://github.com/GMOD/jbrowse-components/pull/2099) Use rbush data
    structure for layout of feature tracks
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.3.2 (2021-07-07)

<details><summary>Packages in this release</summary>
<p>

| Package                           | Download                                                        |
| --------------------------------- | --------------------------------------------------------------- |
| @jbrowse/core                     | https://www.npmjs.com/package/@jbrowse/core                     |
| @jbrowse/plugin-circular-view     | https://www.npmjs.com/package/@jbrowse/plugin-circular-view     |
| @jbrowse/plugin-spreadsheet-view  |                                                                 |
| @jbrowse/plugin-sv-inspector      |                                                                 |
| @jbrowse/plugin-svg               | https://www.npmjs.com/package/@jbrowse/plugin-svg               |
| @jbrowse/plugin-variants          | https://www.npmjs.com/package/@jbrowse/plugin-variants          |
| @jbrowse/desktop                  |                                                                 |
| @jbrowse/react-linear-genome-view | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view |
| @jbrowse/web                      |                                                                 |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2100](https://github.com/GMOD/jbrowse-components/pull/2100) Improve
    descriptions on VCF SVs ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2106](https://github.com/GMOD/jbrowse-components/pull/2106) Use more
    accurate estimator for feature label widths
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#2109](https://github.com/GMOD/jbrowse-components/pull/2109) Make sure to
  wait for assembly to load before downloading canonical refnames in SV
  inspector ([@cmdcolin](https://github.com/cmdcolin))
- [#2111](https://github.com/GMOD/jbrowse-components/pull/2111) Fix "Can't
  resolve '@jbrowse/plugin-legacy-jbrowse'" in
  `@jbrowse/react-linear-genome-view`
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 2

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## 1.3.1 (2021-07-06)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          | https://www.npmjs.com/package/@jbrowse/plugin-legacy-jbrowse     |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#2094](https://github.com/GMOD/jbrowse-components/pull/2094) More usage of
    typography to improve consistent text styling
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2068](https://github.com/GMOD/jbrowse-components/pull/2068) Add
    non-indexed and plaintext VCF Adapter to variants plugin
    ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#2067](https://github.com/GMOD/jbrowse-components/pull/2067) Better error
    message if a file location has an empty string
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2064](https://github.com/GMOD/jbrowse-components/pull/2064) Export
    offscreenCanvasPonyfil from core/util
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2060](https://github.com/GMOD/jbrowse-components/pull/2060) Improve
    performance with large numbers of reference sequences by using MST volatiles
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2050](https://github.com/GMOD/jbrowse-components/pull/2050) Configurable
    app logo for web ([@elliothershberg](https://github.com/elliothershberg))
- Other
  - [#2104](https://github.com/GMOD/jbrowse-components/pull/2104) Use
    ScopedCssBaseline to help style the embedded component
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2015](https://github.com/GMOD/jbrowse-components/pull/2015) Deprecate
    ThemeProvider in `@jbrowse/react-linear-genome-view`
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#2097](https://github.com/GMOD/jbrowse-components/pull/2097) Improve speed
    for laying out features for embedded/mainthreadrpc scenarios
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2096](https://github.com/GMOD/jbrowse-components/pull/2096) Fix issue with
    page reload after editing session title
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2074](https://github.com/GMOD/jbrowse-components/pull/2074) Fix support
    for opening local files in spreadsheet/SV inspector
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2061](https://github.com/GMOD/jbrowse-components/pull/2061) Fix issue with
    using --force error when no track was previously loaded
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2024](https://github.com/GMOD/jbrowse-components/pull/2024) Flip drawing
    of negative strand PAF features in linear synteny and dotplot views
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2023](https://github.com/GMOD/jbrowse-components/pull/2023) Fix infinite
    loop in adding some plugins on desktop
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#2019](https://github.com/GMOD/jbrowse-components/pull/2019) Fix session
    import to use blob map for opening local files
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2071](https://github.com/GMOD/jbrowse-components/pull/2071) Add indicator
    to the end of ref name dropdown to suggest user to type the searchbox for
    more ([@teresam856](https://github.com/teresam856))
  - [#2056](https://github.com/GMOD/jbrowse-components/pull/2056) Fix infinite
    recursion in FromConfigAdaptor by avoiding mutating the passed in data when
    using SimpleFeature ([@cmdcolin](https://github.com/cmdcolin))
  - [#2018](https://github.com/GMOD/jbrowse-components/pull/2018) Fix 3'UTR in
    sequence detail panels when no UTRs are in gff
    ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#1967](https://github.com/GMOD/jbrowse-components/pull/1967) Omit
    configurationSchema snapshot when it matches the default
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2078](https://github.com/GMOD/jbrowse-components/pull/2078) Restore eslint
    rule for no-unused-vars ([@cmdcolin](https://github.com/cmdcolin))
  - [#2051](https://github.com/GMOD/jbrowse-components/pull/2051) Add missing
    named exports to shared core modules
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2045](https://github.com/GMOD/jbrowse-components/pull/2045) Add basic
    architecture for text searching
    ([@teresam856](https://github.com/teresam856))
- Other
  - [#2070](https://github.com/GMOD/jbrowse-components/pull/2070) Remove service
    worker from jbrowse-web ([@cmdcolin](https://github.com/cmdcolin))
  - [#1995](https://github.com/GMOD/jbrowse-components/pull/1995) Pass
    initialDisplay snapshot via separate param to showTrack
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 5

- Caroline Bridge
  ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.3.0 (2021-05-24)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools         |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#2001](https://github.com/GMOD/jbrowse-components/pull/2001) Make tracks
    added using the add track widget a session track if not in adminMode
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1980](https://github.com/GMOD/jbrowse-components/pull/1980) Add popup
    confirmation dialog for unknown session plugins, and use plugins.json as a
    whitelist ([@cmdcolin](https://github.com/cmdcolin))
  - [#1977](https://github.com/GMOD/jbrowse-components/pull/1977) Upgrade
    @material-ui/data-grid ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1982](https://github.com/GMOD/jbrowse-components/pull/1982) Allow manually
    specifying adapter type if filename does not match expected pattern
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1975](https://github.com/GMOD/jbrowse-components/pull/1975) Allow local
    files on the users computer to be opened as tracks in jbrowse-web
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1865](https://github.com/GMOD/jbrowse-components/pull/1865) Show modified
    bases using MM and MP/ML tags in BAM/CRAM
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1984](https://github.com/GMOD/jbrowse-components/pull/1984) Better feature
    details when there are short arrays of json supplied as feature data
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1931](https://github.com/GMOD/jbrowse-components/pull/1931) Create in app
    graphical plugin store
    ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- `core`
  - [#1985](https://github.com/GMOD/jbrowse-components/pull/1985) Avoid error
    calculating UTR on features that have no exon subfeatures
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1954](https://github.com/GMOD/jbrowse-components/pull/1954) Add more
    environments to configSchema create calls to fix ability to use custom jexl
    commands with main thread rendering
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1963](https://github.com/GMOD/jbrowse-components/pull/1963) Fix ability to
    use DialogComponent (used for svg export, pileup sort, etc) on embedded
    components ([@cmdcolin](https://github.com/cmdcolin))
  - [#1945](https://github.com/GMOD/jbrowse-components/pull/1945) Fix hic not
    being able to render due to incorrect lazy loading
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1956](https://github.com/GMOD/jbrowse-components/pull/1956) Fix connection
    behavior ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1966](https://github.com/GMOD/jbrowse-components/pull/1966) Fix ability to
    use add-track force on symlink tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1951](https://github.com/GMOD/jbrowse-components/pull/1951) Fix breakpoint
    split view demo configuration on website
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2002](https://github.com/GMOD/jbrowse-components/pull/2002) Add @jbrowse/img
  to homepage ([@cmdcolin](https://github.com/cmdcolin))
- [#2007](https://github.com/GMOD/jbrowse-components/pull/2007) Update docs for
  modifications/methylation coloring, plugin store, and the sequence panel in
  feature details ([@cmdcolin](https://github.com/cmdcolin))
- [#1976](https://github.com/GMOD/jbrowse-components/pull/1976) reorganize the
  demo page to emphasize the cancer sv demo more
  ([@rbuels](https://github.com/rbuels))
- [#1952](https://github.com/GMOD/jbrowse-components/pull/1952) Add demo for
  1000 genomes extended trio dataset to website
  ([@cmdcolin](https://github.com/cmdcolin))
- [#1862](https://github.com/GMOD/jbrowse-components/pull/1862) Add example for
  using a build-time included plugin to storybook
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#2003](https://github.com/GMOD/jbrowse-components/pull/2003) Make
    SNPCoverage independently generate the modifications tag-color mapping
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `development-tools`
  - [#1930](https://github.com/GMOD/jbrowse-components/pull/1930) Upgrade react
    scripts+react to latest versions ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 4

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Robert Buels ([@rbuels](https://github.com/rbuels))

## 1.2.0 (2021-05-03)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#1125](https://github.com/GMOD/jbrowse-components/pull/1125) Export SVG
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1867](https://github.com/GMOD/jbrowse-components/pull/1867) Virtualized
    tree for tracklist to support having thousands of tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1660](https://github.com/GMOD/jbrowse-components/pull/1660) Allow
    connections to have multiple assemblies
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1864](https://github.com/GMOD/jbrowse-components/pull/1864) Add Material
    UI's DataGrid to re-exports
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1875](https://github.com/GMOD/jbrowse-components/pull/1875) Make drawer
    widget titles stay visible when scrolling inside the widget
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1877](https://github.com/GMOD/jbrowse-components/pull/1877) Add ability to
    copy the text produced by the feature details sequence panel to MS
    Word/Google Docs and preserve styling
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1854](https://github.com/GMOD/jbrowse-components/pull/1854) Make "About
    track" dialog available from tracklist and for non-LGV tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1853](https://github.com/GMOD/jbrowse-components/pull/1853) Add mouseovers
    in feature details that show field descriptions for VCF fields
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1892](https://github.com/GMOD/jbrowse-components/pull/1892) Create new JB2
    plugin store ([@elliothershberg](https://github.com/elliothershberg))
  - [#1901](https://github.com/GMOD/jbrowse-components/pull/1901) Make using
    --out for add-assembly create output directory if it does not exist and fix
    outputting to symlink ([@cmdcolin](https://github.com/cmdcolin))
  - [#1850](https://github.com/GMOD/jbrowse-components/pull/1850) Add true
    breakend ALT strings to the feature details panel
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1878](https://github.com/GMOD/jbrowse-components/pull/1878) Add --delete
    to set-default-session, fix --session
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1861](https://github.com/GMOD/jbrowse-components/pull/1861) Change
    Alignments track "Fade mismatches by quality" setting to a separate config
    param and made it less strict ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#1924](https://github.com/GMOD/jbrowse-components/pull/1924) Fix import of
    BED and navToLocString from spreadsheet views
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1918](https://github.com/GMOD/jbrowse-components/pull/1918) Fix issue with
    some falsy values being hidden in feature details
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1911](https://github.com/GMOD/jbrowse-components/pull/1911) Fix breakpoint
    split view visualizations for files that need ref renaming (e.g. chr1 vs 1)
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1904](https://github.com/GMOD/jbrowse-components/pull/1904) Fix issue with
    synteny polygons displaying slightly offset
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1884](https://github.com/GMOD/jbrowse-components/pull/1884) Fix rIC
    ponyfill for use on Safari ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1912](https://github.com/GMOD/jbrowse-components/pull/1912) Fix reloading
    of local sessions when using React.StrictMode
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1900](https://github.com/GMOD/jbrowse-components/pull/1900) Make clicking
    away from autocomplete popup on track container work
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1878](https://github.com/GMOD/jbrowse-components/pull/1878) Add --delete
    to set-default-session, fix --session
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1871](https://github.com/GMOD/jbrowse-components/pull/1871) Fix crash on
    dotplot/linear synteny import form and when closing linear synteny track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1860](https://github.com/GMOD/jbrowse-components/pull/1860) Fix alignments
    read filter jexl syntax ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1914](https://github.com/GMOD/jbrowse-components/pull/1914) Use MDX to add
  proper image captions in web and pdf documentation
  ([@cmdcolin](https://github.com/cmdcolin))
- [#1855](https://github.com/GMOD/jbrowse-components/pull/1855) Add download
  page in website header and new super-quick-start guide
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#1932](https://github.com/GMOD/jbrowse-components/pull/1932) Update
    analytics and share API URLs to refer to more stable locations
    ([@peterkxie](https://github.com/peterkxie))
  - [#1888](https://github.com/GMOD/jbrowse-components/pull/1888) More lazy
    loading of react components to reduce bundle size
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1790](https://github.com/GMOD/jbrowse-components/pull/1790) Allow
    MainThreadRpcDriver to skip serialization during RPC, improving main-thread
    rendering performance
    ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#1926](https://github.com/GMOD/jbrowse-components/pull/1926) Update website
    to link to demos on cloudfront for better compression
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1868](https://github.com/GMOD/jbrowse-components/pull/1868) Export
    XYPlotRenderer and configSchema
    ([@elliothershberg](https://github.com/elliothershberg))
  - [#1863](https://github.com/GMOD/jbrowse-components/pull/1863) Update
    @gmod/indexedfasta ([@cmdcolin](https://github.com/cmdcolin))
  - [#1795](https://github.com/GMOD/jbrowse-components/pull/1795) Make
    LinearAlignmentsDisplay fully configurable in the UI
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1822](https://github.com/GMOD/jbrowse-components/pull/1822) Let React LGV
    navigate without setting displayedRegion first
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 4

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))

## 1.1.0 (2021-03-29)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#1846](https://github.com/GMOD/jbrowse-components/pull/1846) Improve
    copy+paste in the data grids for feature details
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1814](https://github.com/GMOD/jbrowse-components/pull/1814) Add ability to
    get promoter sequence and intron sequence for genes from the feature details
    panel ([@cmdcolin](https://github.com/cmdcolin))
  - [#1816](https://github.com/GMOD/jbrowse-components/pull/1816) Remove some
    animation effects ([@cmdcolin](https://github.com/cmdcolin))
  - [#1778](https://github.com/GMOD/jbrowse-components/pull/1778) Adds dropdown
    to show drawer widget stack ([@teresam856](https://github.com/teresam856))
  - [#1685](https://github.com/GMOD/jbrowse-components/pull/1685) Change
    callbacks language from JavaScript to Jexl
    ([@peterkxie](https://github.com/peterkxie))
- Other
  - [#1831](https://github.com/GMOD/jbrowse-components/pull/1831) Add dialog for
    launching breakpoint split view from variant feature details
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1803](https://github.com/GMOD/jbrowse-components/pull/1803) Transcript and
    gene glyphs can now display implied UTRs, active by default
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1808](https://github.com/GMOD/jbrowse-components/pull/1808) Add another
    heuristic for returning gene features from BigBed
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1774](https://github.com/GMOD/jbrowse-components/pull/1774) Add warning
    dialog in LGV before returning to import form to prevent accidentally losing
    the current view ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#1811](https://github.com/GMOD/jbrowse-components/pull/1811) Check for
    existence of window more robustly to allow in SSR or node applications
    ([@elliothershberg](https://github.com/elliothershberg))
  - [#1793](https://github.com/GMOD/jbrowse-components/pull/1793) Fix dotplot
    rendering outside it's allowed bounds
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1783](https://github.com/GMOD/jbrowse-components/pull/1783) Add hic
    aborting and fix remoteAbort signal propagation
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1723](https://github.com/GMOD/jbrowse-components/pull/1723) A few bugfixes
    ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#1815](https://github.com/GMOD/jbrowse-components/pull/1815) Clear tracks
    when using "Return to import form"
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1819](https://github.com/GMOD/jbrowse-components/pull/1819) Standardized
    sentence casing on drawer widget titles
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1796](https://github.com/GMOD/jbrowse-components/pull/1796) Bump
    generic-filehandle for fixing CORS errors from Chrome cache pollution
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1824](https://github.com/GMOD/jbrowse-components/pull/1824) Add storybook
  docs page for nextjs usage
  ([@elliothershberg](https://github.com/elliothershberg))
- [#1770](https://github.com/GMOD/jbrowse-components/pull/1770) 1469 storybook
  deploy ([@elliothershberg](https://github.com/elliothershberg))
- [#1807](https://github.com/GMOD/jbrowse-components/pull/1807) Update developer
  guide to cover displays, and highlight working external plugins
  ([@cmdcolin](https://github.com/cmdcolin))
- [#1779](https://github.com/GMOD/jbrowse-components/pull/1779) Collaborative
  release announcement editing ([@rbuels](https://github.com/rbuels))
- [#1791](https://github.com/GMOD/jbrowse-components/pull/1791) Add a couple
  more demos for our live version with MDX
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#1820](https://github.com/GMOD/jbrowse-components/pull/1820) Create
    v1.1.0.md, draft of release announcements
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1823](https://github.com/GMOD/jbrowse-components/pull/1823) Add note about
    previewing changelog to CONTRIBUTING.md
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1834](https://github.com/GMOD/jbrowse-components/pull/1834) Change
    jbrowse-components monorepo default branch from 'master' to 'main'
    ([@rbuels](https://github.com/rbuels))

#### Committers: 6

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))
- Robert Buels ([@rbuels](https://github.com/rbuels))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.0.4 (2021-03-08)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/protein-widget                 |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#1758](https://github.com/GMOD/jbrowse-components/pull/1758) Add ability to
    get stitched together CDS, protein, and cDNA sequences in feature details
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1721](https://github.com/GMOD/jbrowse-components/pull/1721) Manually
    adjust feature height and spacing on alignments track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1728](https://github.com/GMOD/jbrowse-components/pull/1728) Add list of
    loaded plugins to the "About widget" ([@rbuels](https://github.com/rbuels))
  - [#1711](https://github.com/GMOD/jbrowse-components/pull/1711) Add plugin
    top-level configuration ([@teresam856](https://github.com/teresam856))
  - [#1699](https://github.com/GMOD/jbrowse-components/pull/1699) Add sequence
    track for both read and reference genome in the "Linear read vs ref"
    comparison ([@cmdcolin](https://github.com/cmdcolin))
  - [#1701](https://github.com/GMOD/jbrowse-components/pull/1701) Add clickable
    navigation links to supplementary alignments/paired ends locations and
    BND/TRA endpoints in detail widgets
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1601](https://github.com/GMOD/jbrowse-components/pull/1601) Add ability to
    color by per-base quality in alignment tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1640](https://github.com/GMOD/jbrowse-components/pull/1640) Move stats
    calculation to BaseFeatureAdapter ([@cmdcolin](https://github.com/cmdcolin))
  - [#1588](https://github.com/GMOD/jbrowse-components/pull/1588) Add "Get
    sequence" action to LGV rubber-band
    ([@teresam856](https://github.com/teresam856))
- Other
  - [#1743](https://github.com/GMOD/jbrowse-components/pull/1743) Add color
    picker and choice of summary score style for wiggle track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1763](https://github.com/GMOD/jbrowse-components/pull/1763) Add a "CSS
    reset" to jbrowse-react-linear-genome-view to prevent parent styles from
    outside the component leaking in ([@cmdcolin](https://github.com/cmdcolin))
  - [#1756](https://github.com/GMOD/jbrowse-components/pull/1756) Split
    alignments track menu items into "Pileup" and "SNPCoverage" submenus
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1742](https://github.com/GMOD/jbrowse-components/pull/1742) Add ability to
    display crosshatches on the wiggle line/xyplot renderer
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1736](https://github.com/GMOD/jbrowse-components/pull/1736) Fix CLI
    add-track --load inPlace to put exact contents into the config, add better
    CLI example docs ([@cmdcolin](https://github.com/cmdcolin))
  - [#1394](https://github.com/GMOD/jbrowse-components/pull/1394) Add new menu
    items for show/hide feature labels, set max height, and set compact display
    mode ([@cmdcolin](https://github.com/cmdcolin))
  - [#1720](https://github.com/GMOD/jbrowse-components/pull/1720) Standardize
    phred qual scaling between BAM and CRAM and add option to make mismatches
    render in a lighter color when quality is low
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1704](https://github.com/GMOD/jbrowse-components/pull/1704) Add "Show all
    regions in assembly" to import form and make import form show entire region
    when refName selected ([@cmdcolin](https://github.com/cmdcolin))
  - [#1687](https://github.com/GMOD/jbrowse-components/pull/1687) Threshold for
    indicators on SNPCoverage + inverted bargraph of interbase counts for
    sub-threshold events ([@cmdcolin](https://github.com/cmdcolin))
  - [#1695](https://github.com/GMOD/jbrowse-components/pull/1695) Improve
    zoomed-out display of quantitative displays tracks when bicolor pivot is
    active ([@cmdcolin](https://github.com/cmdcolin))
  - [#1680](https://github.com/GMOD/jbrowse-components/pull/1680) Add on click
    functionality to quantitative track features
    ([@teresam856](https://github.com/teresam856))
  - [#1630](https://github.com/GMOD/jbrowse-components/pull/1630) Get column
    names from BED tabix files and other utils for external jbrowse-plugin-gwas
    support ([@cmdcolin](https://github.com/cmdcolin))
  - [#1709](https://github.com/GMOD/jbrowse-components/pull/1709) Improve
    sorting and filtering in variant detail widget
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1688](https://github.com/GMOD/jbrowse-components/pull/1688) Bold insertion
    indicator for large insertions on pileup track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1669](https://github.com/GMOD/jbrowse-components/pull/1669) Allow plain
    json encoding of the session in the URL
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1642](https://github.com/GMOD/jbrowse-components/pull/1642) Enable
    locstring navigation from LGV import form
    ([@teresam856](https://github.com/teresam856))
  - [#1655](https://github.com/GMOD/jbrowse-components/pull/1655) Add GFF3Tabix
    and BEDTabix inference to JB1 connection
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1643](https://github.com/GMOD/jbrowse-components/pull/1643) Add an offset
    that allows all wiggle y-scalebar labels to be visible
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1632](https://github.com/GMOD/jbrowse-components/pull/1632) Displays
    warnings when receiving a session with custom callbacks
    ([@peterkxie](https://github.com/peterkxie))
  - [#1615](https://github.com/GMOD/jbrowse-components/pull/1615) Increase
    pileup maxHeight ([@cmdcolin](https://github.com/cmdcolin))
  - [#1624](https://github.com/GMOD/jbrowse-components/pull/1624) GCContent
    adapter ([@cmdcolin](https://github.com/cmdcolin))
  - [#1614](https://github.com/GMOD/jbrowse-components/pull/1614) Add insertion
    and clip indicators to SNPCoverage views (part of Alignments tracks)
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1610](https://github.com/GMOD/jbrowse-components/pull/1610) Display error
    message from dynamodb session sharing error
    ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#1777](https://github.com/GMOD/jbrowse-components/pull/1777) Quick fix for
    block error ([@cmdcolin](https://github.com/cmdcolin))
  - [#1748](https://github.com/GMOD/jbrowse-components/pull/1748) External
    plugins load after confirming config warning
    ([@peterkxie](https://github.com/peterkxie))
  - [#1750](https://github.com/GMOD/jbrowse-components/pull/1750) Fix pileup
    sorting when using string tag ([@cmdcolin](https://github.com/cmdcolin))
  - [#1747](https://github.com/GMOD/jbrowse-components/pull/1747) Fix the
    position of the popup menu after rubberband select when there is a margin on
    the component e.g. in embedded ([@cmdcolin](https://github.com/cmdcolin))
  - [#1736](https://github.com/GMOD/jbrowse-components/pull/1736) Fix CLI
    add-track --load inPlace to put exact contents into the config, add better
    CLI example docs ([@cmdcolin](https://github.com/cmdcolin))
  - [#1731](https://github.com/GMOD/jbrowse-components/pull/1731) Fix alignment
    track ability to remember the height of the SNPCoverage subtrack on refresh
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1719](https://github.com/GMOD/jbrowse-components/pull/1719) Fix for
    navigation past end of chromosome ([@cmdcolin](https://github.com/cmdcolin))
  - [#1698](https://github.com/GMOD/jbrowse-components/pull/1698) Fix rendering
    read vs ref comparisons with CIGAR strings that use = sign matches
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1697](https://github.com/GMOD/jbrowse-components/pull/1697) Fix
    softclipping configuration setting causing bases to be missed
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1689](https://github.com/GMOD/jbrowse-components/pull/1689) Disable
    copy/delete menu items for reference sequence track
    ([@teresam856](https://github.com/teresam856))
  - [#1682](https://github.com/GMOD/jbrowse-components/pull/1682) Fix parsing of
    BED and BEDPE files with comment header for spreadsheet view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1679](https://github.com/GMOD/jbrowse-components/pull/1679) Fix issue with
    using launching the add track widget on views that are not displaying any
    regions ([@teresam856](https://github.com/teresam856))
  - [#1642](https://github.com/GMOD/jbrowse-components/pull/1642) Enable
    locstring navigation from LGV import form
    ([@teresam856](https://github.com/teresam856))
  - [#1626](https://github.com/GMOD/jbrowse-components/pull/1626) Bug Fix:
    specify assembly in locstring ([@teresam856](https://github.com/teresam856))
  - [#1619](https://github.com/GMOD/jbrowse-components/pull/1619) Fix overview
    scale polygon not appearing properly in some cases
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1714](https://github.com/GMOD/jbrowse-components/pull/1714) Fix ability to
    add a PAF on initial dotplot view creation
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1657](https://github.com/GMOD/jbrowse-components/pull/1657) Fix for track
    using assembly alias not displaying
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1620](https://github.com/GMOD/jbrowse-components/pull/1620) Add error
    reporting on a worker failure ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1725](https://github.com/GMOD/jbrowse-components/pull/1725) JBrowseR release
  ([@elliothershberg](https://github.com/elliothershberg))
- [#1677](https://github.com/GMOD/jbrowse-components/pull/1677) Config guide
  updates ([@elliothershberg](https://github.com/elliothershberg))
- [#1665](https://github.com/GMOD/jbrowse-components/pull/1665) Add Nextstrain
  COVID storybook ([@elliothershberg](https://github.com/elliothershberg))
- [#1670](https://github.com/GMOD/jbrowse-components/pull/1670) typo in
  developer guide docs ([@teresam856](https://github.com/teresam856))
- [#1592](https://github.com/GMOD/jbrowse-components/pull/1592) Website copy
  edits ([@rbuels](https://github.com/rbuels))
- [#1646](https://github.com/GMOD/jbrowse-components/pull/1646) Fix "See code"
  link in CLI docs ([@garrettjstevens](https://github.com/garrettjstevens))
- [#1618](https://github.com/GMOD/jbrowse-components/pull/1618) Add whole-genome
  view and color/sort alignments tutorials to user guide
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#1666](https://github.com/GMOD/jbrowse-components/pull/1666) Move
    "mouseover" config from BaseLinearDisplay to LinearBasicDisplay display
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1751](https://github.com/GMOD/jbrowse-components/pull/1751) Make the
    variant display derive from the feature display
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1716](https://github.com/GMOD/jbrowse-components/pull/1716) Stringify
    labels before adding to rendering to avoid undefineds on label.length
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1713](https://github.com/GMOD/jbrowse-components/pull/1713) Add
    console.error log in block setError
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1663](https://github.com/GMOD/jbrowse-components/pull/1663) Make LGV
    "initialized" not depend on displayedRegions
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1672](https://github.com/GMOD/jbrowse-components/pull/1672) Fix import
    forms crashing if there are no assemblies
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1644](https://github.com/GMOD/jbrowse-components/pull/1644) Bump electron
    from 9.3.1 to 9.4.0 ([@dependabot[bot]](https://github.com/apps/dependabot))
  - [#1641](https://github.com/GMOD/jbrowse-components/pull/1641) Remove codecov
    pr annotations ([@cmdcolin](https://github.com/cmdcolin))
  - [#1609](https://github.com/GMOD/jbrowse-components/pull/1609) Add extra
    checks for release script ([@peterkxie](https://github.com/peterkxie))
- `core`
  - [#1762](https://github.com/GMOD/jbrowse-components/pull/1762) Add
    requestidlecallback ponyfill in @jbrowse/core/util
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1629](https://github.com/GMOD/jbrowse-components/pull/1629) Add
    RegionsAdapter/SequenceAdapter, reorganize base adapters
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1625](https://github.com/GMOD/jbrowse-components/pull/1625) Make
    renderArgs consistent and don't duplicate data
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1414](https://github.com/GMOD/jbrowse-components/pull/1414) Typescriptify
    and MST'ify the add track workflow
    ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 7

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Liu ZH ([@sqwwwok](https://github.com/sqwwwok))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))
- Robert Buels ([@rbuels](https://github.com/rbuels))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))

## 1.0.3 (2021-01-11)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools         |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/protein-widget                 |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#1560](https://github.com/GMOD/jbrowse-components/pull/1560) Provide a
    dialog to add extra genomic context for linear read vs. ref visualization
    ([@elliothershberg](https://github.com/elliothershberg))
  - [#1604](https://github.com/GMOD/jbrowse-components/pull/1604) Add ability to
    filter for read name to the alignments filter dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1599](https://github.com/GMOD/jbrowse-components/pull/1599) Replace 'show
    all regions' with 'show all regions in assembly'
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1595](https://github.com/GMOD/jbrowse-components/pull/1595) Admin server
    GUI enhancements ([@elliothershberg](https://github.com/elliothershberg))
  - [#1584](https://github.com/GMOD/jbrowse-components/pull/1584) Restructure
    demo page and release cancer demo
    ([@elliothershberg](https://github.com/elliothershberg))
  - [#1579](https://github.com/GMOD/jbrowse-components/pull/1579) Create
    --branch and --nightly flags for `jbrowse create` and `jbrowse upgrade`
    commands ([@cmdcolin](https://github.com/cmdcolin))
  - [#1575](https://github.com/GMOD/jbrowse-components/pull/1575) Improve
    mobx-state-tree type validation errors
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1574](https://github.com/GMOD/jbrowse-components/pull/1574) Make softclip
    indicator black if no seq available
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1554](https://github.com/GMOD/jbrowse-components/pull/1554) Coloring
    options with simple color for tag
    ([@peterkxie](https://github.com/peterkxie))
  - [#1565](https://github.com/GMOD/jbrowse-components/pull/1565) Rename jbrowse
    cli add-track --type to --trackType
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1558](https://github.com/GMOD/jbrowse-components/pull/1558) Add docs for
    sequence track, variant track, launching synteny from dotplot, and add UCSC
    plugin to demo ([@cmdcolin](https://github.com/cmdcolin))
  - [#1533](https://github.com/GMOD/jbrowse-components/pull/1533) Display file
    headers in pre tag in about dialogs and bump @gmod/bam and @gmod/tabix
    package versions ([@cmdcolin](https://github.com/cmdcolin))
  - [#1541](https://github.com/GMOD/jbrowse-components/pull/1541) Add more info
    about adding a PAF file to the synteny import form
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1509](https://github.com/GMOD/jbrowse-components/pull/1509) Combine Search
    and Dropdown component on LGV ([@teresam856](https://github.com/teresam856))
  - [#1530](https://github.com/GMOD/jbrowse-components/pull/1530) Add
    spreadsheet filter support for derived columns
    ([@elliothershberg](https://github.com/elliothershberg))
  - [#1483](https://github.com/GMOD/jbrowse-components/pull/1483) Add session
    export to and import from file
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1519](https://github.com/GMOD/jbrowse-components/pull/1519) Add autoSql to
    the bigBed "About this track" dialog
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1531](https://github.com/GMOD/jbrowse-components/pull/1531) Add track menu
    options for autoscale, log scale, histogram fill, setting min/max score, and
    zoom level/resolution for wiggle/snpcoverage tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1473](https://github.com/GMOD/jbrowse-components/pull/1473) Color, filter,
    and sort options for the alignments
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1576](https://github.com/GMOD/jbrowse-components/pull/1576) Add location
    string to tooltip for wiggle and SNPCoverage tracks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1529](https://github.com/GMOD/jbrowse-components/pull/1529) Display
    subfeatures in feature details widget
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `development-tools`
  - [#1578](https://github.com/GMOD/jbrowse-components/pull/1578) Update build
    system for external plugins
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#1608](https://github.com/GMOD/jbrowse-components/pull/1608) Take into
    account offsetX of the rubberband on scalebar zooming
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1597](https://github.com/GMOD/jbrowse-components/pull/1597) Fix crash when
    there are undefined references in the state tree e.g. when a track is
    deleted but still referred to by a session
    ([@peterkxie](https://github.com/peterkxie))
  - [#1598](https://github.com/GMOD/jbrowse-components/pull/1598) Disable 'copy
    to clipboard' while share url being generated
    ([@peterkxie](https://github.com/peterkxie))
  - [#1589](https://github.com/GMOD/jbrowse-components/pull/1589) Fix the
    display of trackhub registry results
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1573](https://github.com/GMOD/jbrowse-components/pull/1573) Update
    hic-straw to fix error for hic files with many scaffolds
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1563](https://github.com/GMOD/jbrowse-components/pull/1563) Remove
    softclip and hardclip from being counted as SNPs in the SNPCoverage
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1559](https://github.com/GMOD/jbrowse-components/pull/1559) Avoid errors
    from breakpoint split view related to getBoundingClientRect on null track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1540](https://github.com/GMOD/jbrowse-components/pull/1540) Fix memory
    leak when side scrolling LGV blocks
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1534](https://github.com/GMOD/jbrowse-components/pull/1534) Fix breakpoint
    split view showing too many connections for paired end ends
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1524](https://github.com/GMOD/jbrowse-components/pull/1524) Move loading
    flag for spreadsheet import wizard to volatile to avoid it persisting across
    refresh ([@cmdcolin](https://github.com/cmdcolin))
  - [#1521](https://github.com/GMOD/jbrowse-components/pull/1521) Add missing
    dep to react-linear-genome-view
    ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1587](https://github.com/GMOD/jbrowse-components/pull/1587) Fix
    positioning of scalebar tooltips, overview scalebar plotting, and refName
    label positioning when displaying many regions
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1547](https://github.com/GMOD/jbrowse-components/pull/1547) Fix analytics
    crashing when using plugins ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1594](https://github.com/GMOD/jbrowse-components/pull/1594) Add GFF3 example
  to quickstart ([@cmdcolin](https://github.com/cmdcolin))
- [#1581](https://github.com/GMOD/jbrowse-components/pull/1581) Add some
  features that are missing from jbrowse 2 to the feature comparison table
  ([@cmdcolin](https://github.com/cmdcolin))
- [#1558](https://github.com/GMOD/jbrowse-components/pull/1558) Add docs for
  sequence track, variant track, launching synteny from dotplot, and add UCSC
  plugin to demo ([@cmdcolin](https://github.com/cmdcolin))
- [#1537](https://github.com/GMOD/jbrowse-components/pull/1537) Add
  CONTRIBUTING.md with tips for getting started with codebase
  ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#1606](https://github.com/GMOD/jbrowse-components/pull/1606) Upgrade
  @testing-library/react and improve test reliability
  ([@cmdcolin](https://github.com/cmdcolin))
- [#1555](https://github.com/GMOD/jbrowse-components/pull/1555) Remove the
  TextDecoder/TextEncoder polyfill ([@cmdcolin](https://github.com/cmdcolin))
- [#1522](https://github.com/GMOD/jbrowse-components/pull/1522) Update oclif and
  remove now unnecessary file copy
  ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 6

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Peter Xie ([@peterkxie](https://github.com/peterkxie))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))
- [@Akusem](https://github.com/Akusem)

## v1.0.2 (2020-12-02)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools         |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           | https://www.npmjs.com/package/@jbrowse/plugin-circular-view      |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/protein-widget                 |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- `core`
  - [#1513](https://github.com/GMOD/jbrowse-components/pull/1513) Add a custom
    scrollbar that overrides the auto-hiding behavior of scrollbars on OSX
    ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- Other
  - [#1514](https://github.com/GMOD/jbrowse-components/pull/1514)
    react-linear-genome-view bug fixes
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1517](https://github.com/GMOD/jbrowse-components/pull/1517) Fix the use of
    filtering display on desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#1512](https://github.com/GMOD/jbrowse-components/pull/1512) Fix setting
    maxDisplayedBpPerPx for pileup display, helps prevent too large an area from
    being rendered ([@cmdcolin](https://github.com/cmdcolin))
  - [#1442](https://github.com/GMOD/jbrowse-components/pull/1442) Change track
    selector togglebutton to normal button
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1506](https://github.com/GMOD/jbrowse-components/pull/1506) Fix
    horizontally flipped translation frames position
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1501](https://github.com/GMOD/jbrowse-components/pull/1501) Fix CLI to
    allow jbrowse create to download newer monorepo tag format
    ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1505](https://github.com/GMOD/jbrowse-components/pull/1505) Fix loading of
    local files in jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 3

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))

## v1.0.1 (2020-11-25)

<details><summary>Packages in this release</summary>
<p>

| Package                                 | Download                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| @jbrowse/core                           | https://www.npmjs.com/package/@jbrowse/core                      |
| @jbrowse/development-tools              | https://www.npmjs.com/package/@jbrowse/development-tools         |
| @jbrowse/plugin-alignments              | https://www.npmjs.com/package/@jbrowse/plugin-alignments         |
| @jbrowse/plugin-bed                     | https://www.npmjs.com/package/@jbrowse/plugin-bed                |
| @jbrowse/plugin-breakpoint-split-view   |                                                                  |
| @jbrowse/plugin-circular-view           |                                                                  |
| @jbrowse/plugin-config                  | https://www.npmjs.com/package/@jbrowse/plugin-config             |
| @jbrowse/plugin-data-management         | https://www.npmjs.com/package/@jbrowse/plugin-data-management    |
| @jbrowse/plugin-dotplot-view            |                                                                  |
| @jbrowse/plugin-filtering               |                                                                  |
| @jbrowse/plugin-gff3                    | https://www.npmjs.com/package/@jbrowse/plugin-gff3               |
| @jbrowse/plugin-hic                     |                                                                  |
| @jbrowse/plugin-legacy-jbrowse          |                                                                  |
| @jbrowse/plugin-linear-comparative-view |                                                                  |
| @jbrowse/plugin-linear-genome-view      | https://www.npmjs.com/package/@jbrowse/plugin-linear-genome-view |
| @jbrowse/plugin-lollipop                |                                                                  |
| @jbrowse/plugin-menus                   |                                                                  |
| @jbrowse/plugin-protein                 |                                                                  |
| @jbrowse/plugin-rdf                     |                                                                  |
| @jbrowse/plugin-sequence                | https://www.npmjs.com/package/@jbrowse/plugin-sequence           |
| @jbrowse/plugin-spreadsheet-view        |                                                                  |
| @jbrowse/plugin-sv-inspector            |                                                                  |
| @jbrowse/plugin-svg                     | https://www.npmjs.com/package/@jbrowse/plugin-svg                |
| @jbrowse/plugin-trackhub-registry       |                                                                  |
| @jbrowse/plugin-variants                | https://www.npmjs.com/package/@jbrowse/plugin-variants           |
| @jbrowse/plugin-wiggle                  | https://www.npmjs.com/package/@jbrowse/plugin-wiggle             |
| @jbrowse/cli                            | https://www.npmjs.com/package/@jbrowse/cli                       |
| @jbrowse/desktop                        |                                                                  |
| @jbrowse/protein-widget                 |                                                                  |
| @jbrowse/react-linear-genome-view       | https://www.npmjs.com/package/@jbrowse/react-linear-genome-view  |
| @jbrowse/web                            |                                                                  |

</p>
</details>

#### :rocket: Enhancement

- Other
  - [#1462](https://github.com/GMOD/jbrowse-components/pull/1462) Allow
    importing gzip and bgzip files in the spreadsheet and SV inspector
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1460](https://github.com/GMOD/jbrowse-components/pull/1460) Add support
    for more bigBed subtypes and fallback for unsupported types
    ([@peterkxie](https://github.com/peterkxie))
  - [#1455](https://github.com/GMOD/jbrowse-components/pull/1455) Add the
    ability to use connection across refreshes in jbrowse-web using session
    connections ([@peterkxie](https://github.com/peterkxie))
  - [#1439](https://github.com/GMOD/jbrowse-components/pull/1439) 1381 improve
    assembly add form ([@elliothershberg](https://github.com/elliothershberg))
  - [#1433](https://github.com/GMOD/jbrowse-components/pull/1433) Make add track
    warning a bit more lenient
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1420](https://github.com/GMOD/jbrowse-components/pull/1420) Add the
    assembly manager feature to jbrowse-desktop
    ([@elliothershberg](https://github.com/elliothershberg))
- `core`
  - [#1458](https://github.com/GMOD/jbrowse-components/pull/1458) Add three
    frame translation to the sequence track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1453](https://github.com/GMOD/jbrowse-components/pull/1453) Change
    "Factory reset" to "Reset session" in jbrowse-web
    ([@teresam856](https://github.com/teresam856))
  - [#1441](https://github.com/GMOD/jbrowse-components/pull/1441) New icon for
    the track selector ([@cmdcolin](https://github.com/cmdcolin))
  - [#1438](https://github.com/GMOD/jbrowse-components/pull/1438) Improve
    assembly loading time by moving to main thread
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1434](https://github.com/GMOD/jbrowse-components/pull/1434) Create
    separate config schema for ReferenceSequenceTrack
    ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- `core`
  - [#1491](https://github.com/GMOD/jbrowse-components/pull/1491) Fix ability to
    add a PAF synteny track with add-track
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1470](https://github.com/GMOD/jbrowse-components/pull/1470) Avoid
    rendering the literal string 'null' in the feature details
    ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1489](https://github.com/GMOD/jbrowse-components/pull/1489) Fix long read
    vs ref CIGAR rendering for horizontally flipped synteny view
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1460](https://github.com/GMOD/jbrowse-components/pull/1460) Add support
    for more bigBed subtypes and fallback for unsupported types
    ([@peterkxie](https://github.com/peterkxie))
  - [#1472](https://github.com/GMOD/jbrowse-components/pull/1472) Wait on
    assemblies that are being tracked by the assemblyManager only
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1466](https://github.com/GMOD/jbrowse-components/pull/1466) Avoid
    rendering the display and renderer settings in the about this track dialog
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1461](https://github.com/GMOD/jbrowse-components/pull/1461) Fix usage of
    jbrowse-cli on node 10.9 related to fs.promises
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1452](https://github.com/GMOD/jbrowse-components/pull/1452) Bug: search
    box disappears from LGV header on smaller widths
    ([@teresam856](https://github.com/teresam856))
  - [#1432](https://github.com/GMOD/jbrowse-components/pull/1432) Make global
    variables window.JBrowseSession and window.JBrowseRootModel available in
    jbrowse-web ([@teresam856](https://github.com/teresam856))
  - [#1431](https://github.com/GMOD/jbrowse-components/pull/1431) Fix connection
    tracks not showing up in track selector
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1428](https://github.com/GMOD/jbrowse-components/pull/1428) Fix the
    listVersions behavior of the jbrowse-cli returning duplicate entries
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1422](https://github.com/GMOD/jbrowse-components/pull/1422) Fix crash from
    empty ALT field in VCF ([@cmdcolin](https://github.com/cmdcolin))
  - [#1413](https://github.com/GMOD/jbrowse-components/pull/1413) Fix ability to
    add CRAM tracks using the web based add-track GUI
    ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1435](https://github.com/GMOD/jbrowse-components/pull/1435) Updates to
  quickstart guides ([@garrettjstevens](https://github.com/garrettjstevens))

#### :house: Internal

- Other
  - [#1437](https://github.com/GMOD/jbrowse-components/pull/1437) Use
    lerna-changelog for changelog generation
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1465](https://github.com/GMOD/jbrowse-components/pull/1465) Establish
    minimum node version of 10.4 for using jbrowse-cli tools
    ([@cmdcolin](https://github.com/cmdcolin))
  - [#1454](https://github.com/GMOD/jbrowse-components/pull/1454) Fix GH
    workflow build ([@elliothershberg](https://github.com/elliothershberg))
  - [#1448](https://github.com/GMOD/jbrowse-components/pull/1448) Move building
    and testing from Travis to GitHub Workflow
    ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1450](https://github.com/GMOD/jbrowse-components/pull/1450) Fix website
    build ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1468](https://github.com/GMOD/jbrowse-components/pull/1468) Have assembly
    manager get plugin manager from factory function args
    ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 5

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))
- [@peterkxie](https://github.com/peterkxie)
