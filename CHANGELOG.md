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
  - [#2847](https://github.com/GMOD/jbrowse-components/pull/2847) Add option to color all the letters on all the reads to the pileup renderer ([@cmdcolin](https://github.com/cmdcolin))
  - [#2849](https://github.com/GMOD/jbrowse-components/pull/2849) Avoid drawing intron subfeatures for gene glyphs ([@cmdcolin](https://github.com/cmdcolin))
  - [#2835](https://github.com/GMOD/jbrowse-components/pull/2835) Hide add track and connection menu items when using embedded component ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#2836](https://github.com/GMOD/jbrowse-components/pull/2836) Display low-quality modifications in SNPCoverage renderer for MM tag ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2809](https://github.com/GMOD/jbrowse-components/pull/2809) Optimizations for alignments tracks and BAM parsing ([@cmdcolin](https://github.com/cmdcolin))
  - [#2828](https://github.com/GMOD/jbrowse-components/pull/2828) Change calculation for number of webworkers for web/desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#2829](https://github.com/GMOD/jbrowse-components/pull/2829) Allow user to specify number of workers ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2775](https://github.com/GMOD/jbrowse-components/pull/2775) New SVG gene glyph with directional arrows ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#2852](https://github.com/GMOD/jbrowse-components/pull/2852) Fix misaligned features under breakpoint split view ([@cmdcolin](https://github.com/cmdcolin))
  - [#2844](https://github.com/GMOD/jbrowse-components/pull/2844) Fix layout of small features without labels for SvgFeatureRenderer ([@cmdcolin](https://github.com/cmdcolin))
  - [#2839](https://github.com/GMOD/jbrowse-components/pull/2839) Fix the drawing of SNP height when the SNPCoverage track is using log scale ([@cmdcolin](https://github.com/cmdcolin))
  - [#2825](https://github.com/GMOD/jbrowse-components/pull/2825) Fix tracklabels positioning not updating in UI after user selection ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2841](https://github.com/GMOD/jbrowse-components/pull/2841) Fix alignments tracks loading excessive data on chromosomes where no features exist ([@cmdcolin](https://github.com/cmdcolin))
  - [#2829](https://github.com/GMOD/jbrowse-components/pull/2829) Allow user to specify number of workers ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 3

- Caroline Bridge ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
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

- [#2820](https://github.com/GMOD/jbrowse-components/pull/2820) Add optimization for BAM and unzip operations ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#2821](https://github.com/GMOD/jbrowse-components/pull/2821) Fixup scroll on wiggle tracks with trackLabels->offset ([@cmdcolin](https://github.com/cmdcolin))
- [#2819](https://github.com/GMOD/jbrowse-components/pull/2819) Fix bug in desktop where first track gets stuck loading ([@garrettjstevens](https://github.com/garrettjstevens))

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
  - [#2796](https://github.com/GMOD/jbrowse-components/pull/2796) Add collapsible accordion sections in configuration editor ([@cmdcolin](https://github.com/cmdcolin))
  - [#2791](https://github.com/GMOD/jbrowse-components/pull/2791) Add new coloring options for dotplot and ability to "rectangularize" dotplot view ([@cmdcolin](https://github.com/cmdcolin))
  - [#2741](https://github.com/GMOD/jbrowse-components/pull/2741) Allow ability to enter a space-separated locstring to open a list of regions ([@cmdcolin](https://github.com/cmdcolin))
  - [#2725](https://github.com/GMOD/jbrowse-components/pull/2725) Refactor InternetAccounts, add standard getFetcher ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2787](https://github.com/GMOD/jbrowse-components/pull/2787) Display the total bp viewed in the header of the dotplot view ([@cmdcolin](https://github.com/cmdcolin))
  - [#2767](https://github.com/GMOD/jbrowse-components/pull/2767) Wiggle and SNPCoverage look and feel improvements ([@cmdcolin](https://github.com/cmdcolin))
  - [#2746](https://github.com/GMOD/jbrowse-components/pull/2746) Add .delta and .chain format adapters, fix ref name aliasing in synteny/dotplot views, and optimize very long CIGAR string in synteny view ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2799](https://github.com/GMOD/jbrowse-components/pull/2799) Exit process after rendering to speed up jb2export ([@cmdcolin](https://github.com/cmdcolin))
  - [#2793](https://github.com/GMOD/jbrowse-components/pull/2793) Add abortcontroller polyfill to jbrowse-img to allow it to run under node 14 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2761](https://github.com/GMOD/jbrowse-components/pull/2761) Add a --clean argument to `jbrowse upgrade` to clean up old files ([@cmdcolin](https://github.com/cmdcolin))
  - [#2760](https://github.com/GMOD/jbrowse-components/pull/2760) Make a configurable refNameColumn in RefNameAliasAdapter ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2798](https://github.com/GMOD/jbrowse-components/pull/2798) Fix bug where web worker would sometimes be called before it was ready ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#2797](https://github.com/GMOD/jbrowse-components/pull/2797) Fix crash plotting methylation in sparse regions ([@cmdcolin](https://github.com/cmdcolin))
  - [#2782](https://github.com/GMOD/jbrowse-components/pull/2782) Fix display of cytobands when horizontally flipped ([@cmdcolin](https://github.com/cmdcolin))
  - [#2678](https://github.com/GMOD/jbrowse-components/pull/2678) Preserve double border line when using trackLabel offset and use smaller gap between snpcoverage and reads ([@cmdcolin](https://github.com/cmdcolin))
  - [#2774](https://github.com/GMOD/jbrowse-components/pull/2774) Fix overwriting broken symlink with --force in add-track CLI ([@cmdcolin](https://github.com/cmdcolin))
  - [#2773](https://github.com/GMOD/jbrowse-components/pull/2773) Fix using global stats autoscale on wiggle tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#2766](https://github.com/GMOD/jbrowse-components/pull/2766) Add a check for empty content blocks to fix rare empty stats estimation ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2804](https://github.com/GMOD/jbrowse-components/pull/2804) Add note about additional pre-requisites to README ([@cmdcolin](https://github.com/cmdcolin))
- [#2762](https://github.com/GMOD/jbrowse-components/pull/2762) Add bookmark widget docs to user guide ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#2813](https://github.com/GMOD/jbrowse-components/pull/2813) Create codeVerifierPKCE only when needed ([@garrettjstevens](https://github.com/garrettjstevens))
- [#2808](https://github.com/GMOD/jbrowse-components/pull/2808) Polyfill window.crypto.getRandomValues in tests ([@garrettjstevens](https://github.com/garrettjstevens))

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

- [#2736](https://github.com/GMOD/jbrowse-components/pull/2736) Add better display of error state in dotplot view and load gzipped PAF files ([@cmdcolin](https://github.com/cmdcolin))
- [#2705](https://github.com/GMOD/jbrowse-components/pull/2705) Increase admin-server payload limit ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#2758](https://github.com/GMOD/jbrowse-components/pull/2758) Use VariantTrack for plaintext VCF type ([@cmdcolin](https://github.com/cmdcolin))
  - [#2738](https://github.com/GMOD/jbrowse-components/pull/2738) Add better catch for XS and TS tag detection from CRAM ([@cmdcolin](https://github.com/cmdcolin))
  - [#2733](https://github.com/GMOD/jbrowse-components/pull/2733) Use sparse array for alignments coverage to fix bug viewing large sparse regions ([@cmdcolin](https://github.com/cmdcolin))
  - [#2734](https://github.com/GMOD/jbrowse-components/pull/2734) Use node fetch instead of follow-redirects in cli ([@cmdcolin](https://github.com/cmdcolin))
  - [#2726](https://github.com/GMOD/jbrowse-components/pull/2726) Handle .bgz file extension for text-index ([@cmdcolin](https://github.com/cmdcolin))
  - [#2727](https://github.com/GMOD/jbrowse-components/pull/2727) Add engines 16 to @jbrowse/img ([@cmdcolin](https://github.com/cmdcolin))
  - [#2723](https://github.com/GMOD/jbrowse-components/pull/2723) Make jbrowse desktop more robust to errors when reading recent sessions file ([@cmdcolin](https://github.com/cmdcolin))
  - [#2715](https://github.com/GMOD/jbrowse-components/pull/2715) Change --target to --root for jbrowse CLI admin-server ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2757](https://github.com/GMOD/jbrowse-components/pull/2757) Fix type confusion with stats estimation causing BAM files to fail byte size calculation ([@cmdcolin](https://github.com/cmdcolin))
  - [#2750](https://github.com/GMOD/jbrowse-components/pull/2750) Add bezierCurveTo to offscreen canvas ponyfill to fix sashimi arcs rendering in alignments track in webkit and firefox ([@cmdcolin](https://github.com/cmdcolin))
  - [#2719](https://github.com/GMOD/jbrowse-components/pull/2719) Avoid uninitialized state during stats estimation ([@cmdcolin](https://github.com/cmdcolin))
  - [#2707](https://github.com/GMOD/jbrowse-components/pull/2707) Fix ability to use authenticated assembly files ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2695](https://github.com/GMOD/jbrowse-components/pull/2695) Fix disabled state on the linear genome view track labels dropdown menu ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2716](https://github.com/GMOD/jbrowse-components/pull/2716) Update to node12 requirement for @jbrowse/cli ([@cmdcolin](https://github.com/cmdcolin))
- [#2605](https://github.com/GMOD/jbrowse-components/pull/2605) Developer guide reorganization and create new API document ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2664](https://github.com/GMOD/jbrowse-components/pull/2664) Use babel config from core in root ([@garrettjstevens](https://github.com/garrettjstevens))

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
  - [#2679](https://github.com/GMOD/jbrowse-components/pull/2679) Optimizations and usability improvements to synteny view ([@cmdcolin](https://github.com/cmdcolin))
  - [#2677](https://github.com/GMOD/jbrowse-components/pull/2677) Save user settings from LGV ([@cmdcolin](https://github.com/cmdcolin))
  - [#2571](https://github.com/GMOD/jbrowse-components/pull/2571) Add stats estimation to JB2 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2666](https://github.com/GMOD/jbrowse-components/pull/2666) Add option to display curved lines and to square the dotplot and synteny views ([@cmdcolin](https://github.com/cmdcolin))
  - [#2672](https://github.com/GMOD/jbrowse-components/pull/2672) Optimize dot plot rendering ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2680](https://github.com/GMOD/jbrowse-components/pull/2680) Improve error handling on jbrowse desktop open sequence dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#2670](https://github.com/GMOD/jbrowse-components/pull/2670) Add mashmap PAF support ([@cmdcolin](https://github.com/cmdcolin))
  - [#2659](https://github.com/GMOD/jbrowse-components/pull/2659) Draw size of deletion on reads in alignments track ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#2165](https://github.com/GMOD/jbrowse-components/pull/2165) Add ability to create new sessions solely from a "session spec" in the URL ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2688](https://github.com/GMOD/jbrowse-components/pull/2688) Fix adapterType dropdown in add track widget ([@cmdcolin](https://github.com/cmdcolin))
  - [#2654](https://github.com/GMOD/jbrowse-components/pull/2654) Fix broken @jbrowse/img by adding babel config back to core ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2686](https://github.com/GMOD/jbrowse-components/pull/2686) Use path.resolve to fix --load symlink in jbrowse CLI ([@cmdcolin](https://github.com/cmdcolin))
  - [#2660](https://github.com/GMOD/jbrowse-components/pull/2660) Fix custom glyphs to apply to features without subfeatures ([@bbimber](https://github.com/bbimber))
  - [#2652](https://github.com/GMOD/jbrowse-components/pull/2652) Fix "module" of embedded React views ([@garrettjstevens](https://github.com/garrettjstevens))

#### :memo: Documentation

- [#2663](https://github.com/GMOD/jbrowse-components/pull/2663) Add documentation for URL params and session spec ([@cmdcolin](https://github.com/cmdcolin))
- [#2655](https://github.com/GMOD/jbrowse-components/pull/2655) Add link to PAG 2022 youtube tutorial on demos page and course archive ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2649](https://github.com/GMOD/jbrowse-components/pull/2649) Add Cypress test of package that uses embedded components ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2648](https://github.com/GMOD/jbrowse-components/pull/2648) Avoid console.warns in tests due to writing to MST nodes that are not alive ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2657](https://github.com/GMOD/jbrowse-components/pull/2657) Fix hot reload using yarn resolution on react-error-overlay ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#2679](https://github.com/GMOD/jbrowse-components/pull/2679) Optimizations and usability improvements to synteny view ([@cmdcolin](https://github.com/cmdcolin))
  - [#2677](https://github.com/GMOD/jbrowse-components/pull/2677) Save user settings from LGV ([@cmdcolin](https://github.com/cmdcolin))
  - [#2571](https://github.com/GMOD/jbrowse-components/pull/2571) Add stats estimation to JB2 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2666](https://github.com/GMOD/jbrowse-components/pull/2666) Add option to display curved lines and to square the dotplot and synteny views ([@cmdcolin](https://github.com/cmdcolin))
  - [#2672](https://github.com/GMOD/jbrowse-components/pull/2672) Optimize dot plot rendering ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2680](https://github.com/GMOD/jbrowse-components/pull/2680) Improve error handling on jbrowse desktop open sequence dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#2670](https://github.com/GMOD/jbrowse-components/pull/2670) Add mashmap PAF support ([@cmdcolin](https://github.com/cmdcolin))
  - [#2659](https://github.com/GMOD/jbrowse-components/pull/2659) Draw size of deletion on reads in alignments track ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#2165](https://github.com/GMOD/jbrowse-components/pull/2165) Add ability to create new sessions solely from a "session spec" in the URL ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2688](https://github.com/GMOD/jbrowse-components/pull/2688) Fix adapterType dropdown in add track widget ([@cmdcolin](https://github.com/cmdcolin))
  - [#2654](https://github.com/GMOD/jbrowse-components/pull/2654) Fix broken @jbrowse/img by adding babel config back to core ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2686](https://github.com/GMOD/jbrowse-components/pull/2686) Use path.resolve to fix --load symlink in jbrowse CLI ([@cmdcolin](https://github.com/cmdcolin))
  - [#2660](https://github.com/GMOD/jbrowse-components/pull/2660) Fix custom glyphs to apply to features without subfeatures ([@bbimber](https://github.com/bbimber))
  - [#2652](https://github.com/GMOD/jbrowse-components/pull/2652) Fix "module" of embedded React views ([@garrettjstevens](https://github.com/garrettjstevens))

#### :memo: Documentation

- [#2663](https://github.com/GMOD/jbrowse-components/pull/2663) Add documentation for URL params and session spec ([@cmdcolin](https://github.com/cmdcolin))
- [#2655](https://github.com/GMOD/jbrowse-components/pull/2655) Add link to PAG 2022 youtube tutorial on demos page and course archive ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2649](https://github.com/GMOD/jbrowse-components/pull/2649) Add Cypress test of package that uses embedded components ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2648](https://github.com/GMOD/jbrowse-components/pull/2648) Avoid console.warns in tests due to writing to MST nodes that are not alive ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2657](https://github.com/GMOD/jbrowse-components/pull/2657) Fix hot reload using yarn resolution on react-error-overlay ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#2679](https://github.com/GMOD/jbrowse-components/pull/2679) Optimizations and usability improvements to synteny view ([@cmdcolin](https://github.com/cmdcolin))
  - [#2677](https://github.com/GMOD/jbrowse-components/pull/2677) Save user settings from LGV ([@cmdcolin](https://github.com/cmdcolin))
  - [#2571](https://github.com/GMOD/jbrowse-components/pull/2571) Add stats estimation to JB2 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2666](https://github.com/GMOD/jbrowse-components/pull/2666) Add option to display curved lines and to square the dotplot and synteny views ([@cmdcolin](https://github.com/cmdcolin))
  - [#2672](https://github.com/GMOD/jbrowse-components/pull/2672) Optimize dot plot rendering ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2680](https://github.com/GMOD/jbrowse-components/pull/2680) Improve error handling on jbrowse desktop open sequence dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#2670](https://github.com/GMOD/jbrowse-components/pull/2670) Add mashmap PAF support ([@cmdcolin](https://github.com/cmdcolin))
  - [#2659](https://github.com/GMOD/jbrowse-components/pull/2659) Draw size of deletion on reads in alignments track ([@cmdcolin](https://github.com/cmdcolin))
- `__mocks__`, `core`
  - [#2165](https://github.com/GMOD/jbrowse-components/pull/2165) Add ability to create new sessions solely from a "session spec" in the URL ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#2688](https://github.com/GMOD/jbrowse-components/pull/2688) Fix adapterType dropdown in add track widget ([@cmdcolin](https://github.com/cmdcolin))
  - [#2654](https://github.com/GMOD/jbrowse-components/pull/2654) Fix broken @jbrowse/img by adding babel config back to core ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2686](https://github.com/GMOD/jbrowse-components/pull/2686) Use path.resolve to fix --load symlink in jbrowse CLI ([@cmdcolin](https://github.com/cmdcolin))
  - [#2660](https://github.com/GMOD/jbrowse-components/pull/2660) Fix custom glyphs to apply to features without subfeatures ([@bbimber](https://github.com/bbimber))
  - [#2652](https://github.com/GMOD/jbrowse-components/pull/2652) Fix "module" of embedded React views ([@garrettjstevens](https://github.com/garrettjstevens))

#### :memo: Documentation

- [#2663](https://github.com/GMOD/jbrowse-components/pull/2663) Add documentation for URL params and session spec ([@cmdcolin](https://github.com/cmdcolin))
- [#2655](https://github.com/GMOD/jbrowse-components/pull/2655) Add link to PAG 2022 youtube tutorial on demos page and course archive ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2649](https://github.com/GMOD/jbrowse-components/pull/2649) Add Cypress test of package that uses embedded components ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2648](https://github.com/GMOD/jbrowse-components/pull/2648) Avoid console.warns in tests due to writing to MST nodes that are not alive ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2657](https://github.com/GMOD/jbrowse-components/pull/2657) Fix hot reload using yarn resolution on react-error-overlay ([@cmdcolin](https://github.com/cmdcolin))

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

- [#2645](https://github.com/GMOD/jbrowse-components/pull/2645) Fix core by not using absolute runtime in babel ([@garrettjstevens](https://github.com/garrettjstevens))

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

- [#2632](https://github.com/GMOD/jbrowse-components/pull/2632) Add vertical resize handle to dotplot view ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#2629](https://github.com/GMOD/jbrowse-components/pull/2629) Add ability to get parent feature in jexl syntax with either parent(feature) or get(feature,'parent') ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#2601](https://github.com/GMOD/jbrowse-components/pull/2601) Allow opening multiple sequences from the desktop start screen ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2623](https://github.com/GMOD/jbrowse-components/pull/2623) Adjust label width on base feature detail to enforce better alignment ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))

#### :bug: Bug Fix

- Other
  - [#2612](https://github.com/GMOD/jbrowse-components/pull/2612) Fix ability to remove plugins ([@cmdcolin](https://github.com/cmdcolin))
  - [#2622](https://github.com/GMOD/jbrowse-components/pull/2622) Fix GUI color editor rgba string format ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2607](https://github.com/GMOD/jbrowse-components/pull/2607) Fix wiggle tooltip crash on non-numerical inputs ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2626](https://github.com/GMOD/jbrowse-components/pull/2626) Fix bad layout resulting in features being unable to be clicked in embedded mode ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2595](https://github.com/GMOD/jbrowse-components/pull/2595) Use some newly available TypeScript types ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2576](https://github.com/GMOD/jbrowse-components/pull/2576) Use TypeScript parameter properties ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 3

- Caroline Bridge ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
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
  - [#2600](https://github.com/GMOD/jbrowse-components/pull/2600) Fix broken published build of jbrowse/development-tools ([@garrettjstevens](https://github.com/garrettjstevens))

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
  - [#2579](https://github.com/GMOD/jbrowse-components/pull/2579) Add help text and help dialog for the RefNameAutocomplete ([@cmdcolin](https://github.com/cmdcolin))
  - [#2553](https://github.com/GMOD/jbrowse-components/pull/2553) Add sashimi-style arcs for RNA-seq type skips on SNPCoverage display ([@cmdcolin](https://github.com/cmdcolin))
  - [#2552](https://github.com/GMOD/jbrowse-components/pull/2552) Change border on non-cytoband OverviewScaleBar visible region back to blue and cytoband OverviewScaleBar to a little lighter fill ([@cmdcolin](https://github.com/cmdcolin))
  - [#2509](https://github.com/GMOD/jbrowse-components/pull/2509) Implement prop interface for providing arbitrary user-defined glyphs to SvgFeatureRenderer ([@hextraza](https://github.com/hextraza))
  - [#2485](https://github.com/GMOD/jbrowse-components/pull/2485) Only use one button, "Go", in text search ambiguous results dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#2501](https://github.com/GMOD/jbrowse-components/pull/2501) Add a tooltip to desktop session path so you can see the full path if it's cut off ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2580](https://github.com/GMOD/jbrowse-components/pull/2580) Make core snackbar notifications module with auto-dismissing info/success level notifications ([@cmdcolin](https://github.com/cmdcolin))
  - [#2534](https://github.com/GMOD/jbrowse-components/pull/2534) New display type for drawing arcs ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#2590](https://github.com/GMOD/jbrowse-components/pull/2590) Add more exports that can be used by plugins ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2578](https://github.com/GMOD/jbrowse-components/pull/2578) Add layouts code to core re-exports ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2523](https://github.com/GMOD/jbrowse-components/pull/2523) Performance optimizations for alignments tracks, particularly those with many short reads ([@cmdcolin](https://github.com/cmdcolin))
  - [#2500](https://github.com/GMOD/jbrowse-components/pull/2500) Add RenderProps to core/pluggableElementTypes export ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`, `development-tools`
  - [#2487](https://github.com/GMOD/jbrowse-components/pull/2487) Add support for additional types of plugin formats (commonjs, esm) to allow access to node modules on jbrowse desktop ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#2594](https://github.com/GMOD/jbrowse-components/pull/2594) Fix infinite loop bug while searching certain strings and handle multi-word searches better ([@cmdcolin](https://github.com/cmdcolin))
  - [#2589](https://github.com/GMOD/jbrowse-components/pull/2589) Fix occasional failures observed from running text-index command ([@cmdcolin](https://github.com/cmdcolin))
  - [#2583](https://github.com/GMOD/jbrowse-components/pull/2583) Fix for alignments track base modifications display regarding skipped bases on Mm tag ([@cmdcolin](https://github.com/cmdcolin))
  - [#2556](https://github.com/GMOD/jbrowse-components/pull/2556) Fix ability to access BigWig tracks on http basic auth for some cases ([@cmdcolin](https://github.com/cmdcolin))
  - [#2577](https://github.com/GMOD/jbrowse-components/pull/2577) Fix ability to use --indexFile on VCF/GFF tabix and CRAM files and add plaintext VCF, GFF, GTF support to add-track CLI ([@cmdcolin](https://github.com/cmdcolin))
  - [#2521](https://github.com/GMOD/jbrowse-components/pull/2521) Fix ability to search for tracks with parentheses in tracklist ([@cmdcolin](https://github.com/cmdcolin))
  - [#2512](https://github.com/GMOD/jbrowse-components/pull/2512) Fix [object Window] issue in alignment read vs reference dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#2499](https://github.com/GMOD/jbrowse-components/pull/2499) Add missing dependency to CLI ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2585](https://github.com/GMOD/jbrowse-components/pull/2585) Fix ability to use "Color by methylation" on files that require refname renaming ([@cmdcolin](https://github.com/cmdcolin))
  - [#2517](https://github.com/GMOD/jbrowse-components/pull/2517) Remove aborting on adapter loading process to fix some tracks getting stuck in infinite loading state ([@cmdcolin](https://github.com/cmdcolin))
  - [#2564](https://github.com/GMOD/jbrowse-components/pull/2564) Start looking for parents with parent, not self in findParentThat ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2563](https://github.com/GMOD/jbrowse-components/pull/2563) Restore ability to load plugins from relative URL ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2533](https://github.com/GMOD/jbrowse-components/pull/2533) Fix drawer widget minimized button being unclickable when overlapping with a view ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2522](https://github.com/GMOD/jbrowse-components/pull/2522) Add circular genome view storybook ([@cmdcolin](https://github.com/cmdcolin))
- [#2508](https://github.com/GMOD/jbrowse-components/pull/2508) Update docs for embedded components ([@teresam856](https://github.com/teresam856))
- [#2495](https://github.com/GMOD/jbrowse-components/pull/2495) Improve organization on docs landing page ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2597](https://github.com/GMOD/jbrowse-components/pull/2597) Fix flaky tests related to auth and canvas image snapshots ([@cmdcolin](https://github.com/cmdcolin))
  - [#2504](https://github.com/GMOD/jbrowse-components/pull/2504) Spreadsheet change jbrequire to es6 imports ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 6

- Caroline Bridge ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
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
  - [#2488](https://github.com/GMOD/jbrowse-components/pull/2488) Improve usability of the search result autocomplete when typing in via keyboard ([@cmdcolin](https://github.com/cmdcolin))
  - [#2267](https://github.com/GMOD/jbrowse-components/pull/2267) Add cytoband to overview scale bar in LGV ([@cmdcolin](https://github.com/cmdcolin))
  - [#2447](https://github.com/GMOD/jbrowse-components/pull/2447) Drawer widget tooltips and use position: fixed on fab ([@cmdcolin](https://github.com/cmdcolin))
  - [#2299](https://github.com/GMOD/jbrowse-components/pull/2299) Add new pluggable element type and properties to adapter type for registering adapter association with 'add track' workflow ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- Other
  - [#2484](https://github.com/GMOD/jbrowse-components/pull/2484) "Add custom plugin" dialog improvements ([@cmdcolin](https://github.com/cmdcolin))
  - [#2389](https://github.com/GMOD/jbrowse-components/pull/2389) Create plaintext GtfAdapter in plugins/gtf ([@teresam856](https://github.com/teresam856))
  - [#2443](https://github.com/GMOD/jbrowse-components/pull/2443) Support plaintext fasta on desktop by dynamically creating a FAI file on the fly ([@cmdcolin](https://github.com/cmdcolin))
  - [#2479](https://github.com/GMOD/jbrowse-components/pull/2479) Allow gzipped Gff3Adapter input and use 512MB limit ([@cmdcolin](https://github.com/cmdcolin))
  - [#2467](https://github.com/GMOD/jbrowse-components/pull/2467) Set default session dialog redesign ([@cmdcolin](https://github.com/cmdcolin))
  - [#2461](https://github.com/GMOD/jbrowse-components/pull/2461) Add assembly manager back into tools menu on jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#2442](https://github.com/GMOD/jbrowse-components/pull/2442) Add simple loading screen for LGV ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#2494](https://github.com/GMOD/jbrowse-components/pull/2494) Add polyfill for text-index compatibility with node 10 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2492](https://github.com/GMOD/jbrowse-components/pull/2492) Fix ability to open breakpoint split view from a BEDPE row in SV inspector ([@cmdcolin](https://github.com/cmdcolin))
  - [#2480](https://github.com/GMOD/jbrowse-components/pull/2480) Fix refName renaming on VcfAdapter for files that don't have ##contig lines ([@cmdcolin](https://github.com/cmdcolin))
  - [#2469](https://github.com/GMOD/jbrowse-components/pull/2469) Fix embedded crash when opening dialogs ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2451](https://github.com/GMOD/jbrowse-components/pull/2451) Fix issue with intermittent text-index failures and improve speed ([@cmdcolin](https://github.com/cmdcolin))
  - [#2439](https://github.com/GMOD/jbrowse-components/pull/2439) Fix adding plugins on desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#2426](https://github.com/GMOD/jbrowse-components/pull/2426) Fix CLI create/upgrade failing to find the latest release ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2457](https://github.com/GMOD/jbrowse-components/pull/2457) Fix linear synteny view import form failure ([@cmdcolin](https://github.com/cmdcolin))
  - [#2444](https://github.com/GMOD/jbrowse-components/pull/2444) Fix crash when chromSizesLocation not specified when loading TwoBitAdapter in GUI ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2446](https://github.com/GMOD/jbrowse-components/pull/2446) Improve some CLI --help messages ([@cmdcolin](https://github.com/cmdcolin))
- [#2437](https://github.com/GMOD/jbrowse-components/pull/2437) Add example of defining and using a plugin with the embedded component ([@cmdcolin](https://github.com/cmdcolin))
- [#2430](https://github.com/GMOD/jbrowse-components/pull/2430) Website optimize for less layout shift ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#2445](https://github.com/GMOD/jbrowse-components/pull/2445) Create core snapshot error message component ([@cmdcolin](https://github.com/cmdcolin))
  - [#2288](https://github.com/GMOD/jbrowse-components/pull/2288) Add extra re-exports for default modules ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 4

- Caroline Bridge ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
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
  - [#2413](https://github.com/GMOD/jbrowse-components/pull/2413) Bundle size savings ([@cmdcolin](https://github.com/cmdcolin))
  - [#2390](https://github.com/GMOD/jbrowse-components/pull/2390) Support plain text (non-tabix'ed) GFF files with new Gff3Adapter ([@teresam856](https://github.com/teresam856))
  - [#2384](https://github.com/GMOD/jbrowse-components/pull/2384) Allow docking the drawer on the left side of the screen ([@cmdcolin](https://github.com/cmdcolin))
  - [#2387](https://github.com/GMOD/jbrowse-components/pull/2387) Add bulk delete of sessions on jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#2279](https://github.com/GMOD/jbrowse-components/pull/2279) Add ability to access authenticated resources using pluggable internet accounts framework ([@peterkxie](https://github.com/peterkxie))
- Other
  - [#2388](https://github.com/GMOD/jbrowse-components/pull/2388) Create "quickstart list" on jbrowse-desktop which users can add to ([@cmdcolin](https://github.com/cmdcolin))
  - [#2385](https://github.com/GMOD/jbrowse-components/pull/2385) Ensure all dependencies are properly specified in package.json files using eslint-plugin-import ([@cmdcolin](https://github.com/cmdcolin))
  - [#2373](https://github.com/GMOD/jbrowse-components/pull/2373) Add auto update functionality for jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#2369](https://github.com/GMOD/jbrowse-components/pull/2369) Add tooltip with track description to track selector ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2258](https://github.com/GMOD/jbrowse-components/pull/2258) Update admin-server to accept value from ?config= so that multiple configs could be edited ([@cmdcolin](https://github.com/cmdcolin))
  - [#2321](https://github.com/GMOD/jbrowse-components/pull/2321) Add show descriptions toggle box to most feature tracks ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#2355](https://github.com/GMOD/jbrowse-components/pull/2355) Allow prefix and exact matches jb1 text search ([@cmdcolin](https://github.com/cmdcolin))
  - [#2348](https://github.com/GMOD/jbrowse-components/pull/2348) Fix ability to use JB1 backcompat text search adapter ([@teresam856](https://github.com/teresam856))
  - [#2322](https://github.com/GMOD/jbrowse-components/pull/2322) Fix install plugin workflow and error handling on desktop, update to electron 15 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2329](https://github.com/GMOD/jbrowse-components/pull/2329) Fix bugs preventing embedded circular genome view from rendering in some circumstances ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2352](https://github.com/GMOD/jbrowse-components/pull/2352) Better keyboard navigations on text search autocomplete component ([@cmdcolin](https://github.com/cmdcolin))
  - [#2332](https://github.com/GMOD/jbrowse-components/pull/2332) Fix ability to use LocalFile on nodejs-based apps e.g. @jbrowse/img ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2407](https://github.com/GMOD/jbrowse-components/pull/2407) Update website for jbrowse-desktop release ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
- [#2328](https://github.com/GMOD/jbrowse-components/pull/2328) Use ../ for all doc links and use trailing slash to fix links ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#2382](https://github.com/GMOD/jbrowse-components/pull/2382) Export RefNameAutocomplete and ViewModel from LinearGenomeView for downstream usage ([@hextraza](https://github.com/hextraza))
  - [#2336](https://github.com/GMOD/jbrowse-components/pull/2336) Add jbrowse-img to monorepo ([@cmdcolin](https://github.com/cmdcolin))
  - [#2324](https://github.com/GMOD/jbrowse-components/pull/2324) Remove unused wrapForRpc functionality ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2379](https://github.com/GMOD/jbrowse-components/pull/2379) Bump typescript to 4.4.3 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2363](https://github.com/GMOD/jbrowse-components/pull/2363) Add some typescripting of some MST models and components ([@cmdcolin](https://github.com/cmdcolin))
  - [#2351](https://github.com/GMOD/jbrowse-components/pull/2351) Use main "module" field instead of "browser" from dependency package json files electron builds ([@cmdcolin](https://github.com/cmdcolin))
  - [#2323](https://github.com/GMOD/jbrowse-components/pull/2323) Remove session related menu items from jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 6

- Caroline Bridge ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
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
  - [#2287](https://github.com/GMOD/jbrowse-components/pull/2287) Use react-popper to reduce tooltip lag on pages with many elements ([@cmdcolin](https://github.com/cmdcolin))
  - [#2294](https://github.com/GMOD/jbrowse-components/pull/2294) Don't rely on SVTYPE=BND for breakend split view options and thicker mouseover chords on circular views ([@cmdcolin](https://github.com/cmdcolin))
  - [#2272](https://github.com/GMOD/jbrowse-components/pull/2272) Auto adjust box RefNameAutocomplete width based on refName length ([@cmdcolin](https://github.com/cmdcolin))
  - [#2243](https://github.com/GMOD/jbrowse-components/pull/2243) Import bookmarks functionality for grid bookmark widget ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2247](https://github.com/GMOD/jbrowse-components/pull/2247) New jbrowse-desktop start screen design ([@cmdcolin](https://github.com/cmdcolin))
  - [#2254](https://github.com/GMOD/jbrowse-components/pull/2254) Better error reporting from web worker and chrom sizes adapter errors ([@cmdcolin](https://github.com/cmdcolin))
  - [#1881](https://github.com/GMOD/jbrowse-components/pull/1881) Add new text searching functionality to core, with `jbrowse text-index` CLI command to generate trix index ([@teresam856](https://github.com/teresam856))

#### :bug: Bug Fix

- `core`
  - [#2320](https://github.com/GMOD/jbrowse-components/pull/2320) Fix issue where add track widget doesn't infer adapters on second usage ([@cmdcolin](https://github.com/cmdcolin))
  - [#2250](https://github.com/GMOD/jbrowse-components/pull/2250) Prevent the ToggleButton for the FileSelector toggling to local file when only URL should be available ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2309](https://github.com/GMOD/jbrowse-components/pull/2309) Fix mouseover selection appearing across unrelated blocks ([@cmdcolin](https://github.com/cmdcolin))
  - [#2283](https://github.com/GMOD/jbrowse-components/pull/2283) Fix ability for the variant detail panel to create breakpoint split view for <TRA> elements ([@cmdcolin](https://github.com/cmdcolin))
  - [#2268](https://github.com/GMOD/jbrowse-components/pull/2268) Fix autocomplete height on small displays ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2300](https://github.com/GMOD/jbrowse-components/pull/2300) Release announcement draft v1.4.0 ([@teresam856](https://github.com/teresam856))
- [#2310](https://github.com/GMOD/jbrowse-components/pull/2310) Add cancer demos to the demos page on website ([@cmdcolin](https://github.com/cmdcolin))
- [#2253](https://github.com/GMOD/jbrowse-components/pull/2253) Add note about legacy-peer-deps to embedded component readme ([@cmdcolin](https://github.com/cmdcolin))
- [#2262](https://github.com/GMOD/jbrowse-components/pull/2262) Add more MDX documentation pages to @jbrowse/react-linear-genome-view storybooks ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#2263](https://github.com/GMOD/jbrowse-components/pull/2263) Force publish all packages on release ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#2163](https://github.com/GMOD/jbrowse-components/pull/2163) Add new embeddable React Circular Genome View ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2229](https://github.com/GMOD/jbrowse-components/pull/2229) Use extendPluggableElement for context menu items ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2233](https://github.com/GMOD/jbrowse-components/pull/2233) Add optional chromSizes config slot to TwoBitAdapter to speed up loading of TwoBit files with many refseqs ([@cmdcolin](https://github.com/cmdcolin))
  - [#2199](https://github.com/GMOD/jbrowse-components/pull/2199) Make the BED parser not interpret general tab delimited data as BED12 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2241](https://github.com/GMOD/jbrowse-components/pull/2241) Restore previous window location when re-opening on desktop ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2203](https://github.com/GMOD/jbrowse-components/pull/2203) Add a helpful message if there is a 404 on config.json error ([@cmdcolin](https://github.com/cmdcolin))
  - [#2204](https://github.com/GMOD/jbrowse-components/pull/2204) Hide reads with unmapped flag by default in alignments tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#2198](https://github.com/GMOD/jbrowse-components/pull/2198) Add better inversion visualization to read vs reference visualizations ([@cmdcolin](https://github.com/cmdcolin))
  - [#2154](https://github.com/GMOD/jbrowse-components/pull/2154) Add UMD build of react-linear-genome-view for plain-js use ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2236](https://github.com/GMOD/jbrowse-components/pull/2236) Detect assembly loading error and encapsulate error instead of failing at app level ([@cmdcolin](https://github.com/cmdcolin))
  - [#2029](https://github.com/GMOD/jbrowse-components/pull/2029) Polish desktop builds ([@elliothershberg](https://github.com/elliothershberg))
  - [#2140](https://github.com/GMOD/jbrowse-components/pull/2140) New core plugin that adds a "bookmarked regions" list widget, new extension points system ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- `core`
  - [#2245](https://github.com/GMOD/jbrowse-components/pull/2245) Fix missing regenerator runtime dependency in core ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2202](https://github.com/GMOD/jbrowse-components/pull/2202) Fixed a crash when an incompatible adapter is selected for provided data in 'open track' ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#2197](https://github.com/GMOD/jbrowse-components/pull/2197) Fix handle leak for killed worker checker ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2208](https://github.com/GMOD/jbrowse-components/pull/2208) Fix issue where collapsed categories were not remembered after toggling a track ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2192](https://github.com/GMOD/jbrowse-components/pull/2192) Update Linear Genome View embedding docs ([@garrettjstevens](https://github.com/garrettjstevens))

#### :house: Internal

- `core`
  - [#2057](https://github.com/GMOD/jbrowse-components/pull/2057) Use idMaker for dataAdapterCache key for faster FromConfigAdapter performance ([@cmdcolin](https://github.com/cmdcolin))
  - [#2231](https://github.com/GMOD/jbrowse-components/pull/2231) Export offscreenCanvasUtils ([@cmdcolin](https://github.com/cmdcolin))
  - [#2226](https://github.com/GMOD/jbrowse-components/pull/2226) Use superRenderProps and superTrackMenuItems for better simulated inheritance model ([@cmdcolin](https://github.com/cmdcolin))
  - [#1874](https://github.com/GMOD/jbrowse-components/pull/1874) Add aborting to CoreGetFeatures rpcManager call ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#2232](https://github.com/GMOD/jbrowse-components/pull/2232) Remove filtering display type from core ([@cmdcolin](https://github.com/cmdcolin))
  - [#2234](https://github.com/GMOD/jbrowse-components/pull/2234) Add rootModel setError on jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 4

- Caroline Bridge ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
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
  - [#2127](https://github.com/GMOD/jbrowse-components/pull/2127) Add example dataset for COLO829 ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2141](https://github.com/GMOD/jbrowse-components/pull/2141) Update to @material-ui/core@4.12.2 ([@cmdcolin](https://github.com/cmdcolin))
  - [#2126](https://github.com/GMOD/jbrowse-components/pull/2126) Allow opening plaintext .vcf files from the "Add track" workflow ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#2159](https://github.com/GMOD/jbrowse-components/pull/2159) Stop local storage quota-exceeded errors preventing the app from starting ([@cmdcolin](https://github.com/cmdcolin))
  - [#2161](https://github.com/GMOD/jbrowse-components/pull/2161) Remove outline from clicking on SVG chord tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#2157](https://github.com/GMOD/jbrowse-components/pull/2157) Fix rendering of negative strand alignment modifications/methylation ([@cmdcolin](https://github.com/cmdcolin))
  - [#2131](https://github.com/GMOD/jbrowse-components/pull/2131) Fix mouseovers/click handlers after "force load" button pressed ([@cmdcolin](https://github.com/cmdcolin))
  - [#2128](https://github.com/GMOD/jbrowse-components/pull/2128) Fix using the "Color by modifications" setting on files that need ref renaming ([@cmdcolin](https://github.com/cmdcolin))
  - [#2115](https://github.com/GMOD/jbrowse-components/pull/2115) Fix bug where sometimes plugin could not be removed from UI ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2119](https://github.com/GMOD/jbrowse-components/pull/2119) Fix loading indicator on the reference sequence selector getting stuck ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2101](https://github.com/GMOD/jbrowse-components/pull/2101) Fix behavior of the end-of-list indicator in refNameAutocomplete to always display as a disabled item ([@teresam856](https://github.com/teresam856))

#### :house: Internal

- Other
  - [#2152](https://github.com/GMOD/jbrowse-components/pull/2152) Remove storybook symlink workaround ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#2099](https://github.com/GMOD/jbrowse-components/pull/2099) Use rbush data structure for layout of feature tracks ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#2100](https://github.com/GMOD/jbrowse-components/pull/2100) Improve descriptions on VCF SVs ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2106](https://github.com/GMOD/jbrowse-components/pull/2106) Use more accurate estimator for feature label widths ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- [#2109](https://github.com/GMOD/jbrowse-components/pull/2109) Make sure to wait for assembly to load before downloading canonical refnames in SV inspector ([@cmdcolin](https://github.com/cmdcolin))
- [#2111](https://github.com/GMOD/jbrowse-components/pull/2111) Fix "Can't resolve '@jbrowse/plugin-legacy-jbrowse'" in `@jbrowse/react-linear-genome-view` ([@garrettjstevens](https://github.com/garrettjstevens))

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
  - [#2094](https://github.com/GMOD/jbrowse-components/pull/2094) More usage of typography to improve consistent text styling ([@cmdcolin](https://github.com/cmdcolin))
  - [#2068](https://github.com/GMOD/jbrowse-components/pull/2068) Add non-indexed and plaintext VCF Adapter to variants plugin ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
  - [#2067](https://github.com/GMOD/jbrowse-components/pull/2067) Better error message if a file location has an empty string ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2064](https://github.com/GMOD/jbrowse-components/pull/2064) Export offscreenCanvasPonyfil from core/util ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2060](https://github.com/GMOD/jbrowse-components/pull/2060) Improve performance with large numbers of reference sequences by using MST volatiles ([@cmdcolin](https://github.com/cmdcolin))
  - [#2050](https://github.com/GMOD/jbrowse-components/pull/2050) Configurable app logo for web ([@elliothershberg](https://github.com/elliothershberg))
- Other
  - [#2104](https://github.com/GMOD/jbrowse-components/pull/2104) Use ScopedCssBaseline to help style the embedded component ([@cmdcolin](https://github.com/cmdcolin))
  - [#2015](https://github.com/GMOD/jbrowse-components/pull/2015) Deprecate ThemeProvider in `@jbrowse/react-linear-genome-view` ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#2097](https://github.com/GMOD/jbrowse-components/pull/2097) Improve speed for laying out features for embedded/mainthreadrpc scenarios ([@cmdcolin](https://github.com/cmdcolin))
  - [#2096](https://github.com/GMOD/jbrowse-components/pull/2096) Fix issue with page reload after editing session title ([@cmdcolin](https://github.com/cmdcolin))
  - [#2074](https://github.com/GMOD/jbrowse-components/pull/2074) Fix support for opening local files in spreadsheet/SV inspector ([@cmdcolin](https://github.com/cmdcolin))
  - [#2061](https://github.com/GMOD/jbrowse-components/pull/2061) Fix issue with using --force error when no track was previously loaded ([@cmdcolin](https://github.com/cmdcolin))
  - [#2024](https://github.com/GMOD/jbrowse-components/pull/2024) Flip drawing of negative strand PAF features in linear synteny and dotplot views ([@cmdcolin](https://github.com/cmdcolin))
  - [#2023](https://github.com/GMOD/jbrowse-components/pull/2023) Fix infinite loop in adding some plugins on desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#2019](https://github.com/GMOD/jbrowse-components/pull/2019) Fix session import to use blob map for opening local files ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#2071](https://github.com/GMOD/jbrowse-components/pull/2071) Add indicator to the end of ref name dropdown to suggest user to type the searchbox for more ([@teresam856](https://github.com/teresam856))
  - [#2056](https://github.com/GMOD/jbrowse-components/pull/2056) Fix infinite recursion in FromConfigAdaptor by avoiding mutating the passed in data when using SimpleFeature ([@cmdcolin](https://github.com/cmdcolin))
  - [#2018](https://github.com/GMOD/jbrowse-components/pull/2018) Fix 3'UTR in sequence detail panels when no UTRs are in gff ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#1967](https://github.com/GMOD/jbrowse-components/pull/1967) Omit configurationSchema snapshot when it matches the default ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2078](https://github.com/GMOD/jbrowse-components/pull/2078) Restore eslint rule for no-unused-vars ([@cmdcolin](https://github.com/cmdcolin))
  - [#2051](https://github.com/GMOD/jbrowse-components/pull/2051) Add missing named exports to shared core modules ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#2045](https://github.com/GMOD/jbrowse-components/pull/2045) Add basic architecture for text searching ([@teresam856](https://github.com/teresam856))
- Other
  - [#2070](https://github.com/GMOD/jbrowse-components/pull/2070) Remove service worker from jbrowse-web ([@cmdcolin](https://github.com/cmdcolin))
  - [#1995](https://github.com/GMOD/jbrowse-components/pull/1995) Pass initialDisplay snapshot via separate param to showTrack ([@cmdcolin](https://github.com/cmdcolin))

#### Committers: 5

- Caroline Bridge ([@carolinebridge-oicr](https://github.com/carolinebridge-oicr))
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
  - [#2001](https://github.com/GMOD/jbrowse-components/pull/2001) Make tracks added using the add track widget a session track if not in adminMode ([@cmdcolin](https://github.com/cmdcolin))
  - [#1980](https://github.com/GMOD/jbrowse-components/pull/1980) Add popup confirmation dialog for unknown session plugins, and use plugins.json as a whitelist ([@cmdcolin](https://github.com/cmdcolin))
  - [#1977](https://github.com/GMOD/jbrowse-components/pull/1977) Upgrade @material-ui/data-grid ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1982](https://github.com/GMOD/jbrowse-components/pull/1982) Allow manually specifying adapter type if filename does not match expected pattern ([@cmdcolin](https://github.com/cmdcolin))
  - [#1975](https://github.com/GMOD/jbrowse-components/pull/1975) Allow local files on the users computer to be opened as tracks in jbrowse-web ([@cmdcolin](https://github.com/cmdcolin))
  - [#1865](https://github.com/GMOD/jbrowse-components/pull/1865) Show modified bases using MM and MP/ML tags in BAM/CRAM ([@cmdcolin](https://github.com/cmdcolin))
  - [#1984](https://github.com/GMOD/jbrowse-components/pull/1984) Better feature details when there are short arrays of json supplied as feature data ([@cmdcolin](https://github.com/cmdcolin))
  - [#1931](https://github.com/GMOD/jbrowse-components/pull/1931) Create in app graphical plugin store ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- `core`
  - [#1985](https://github.com/GMOD/jbrowse-components/pull/1985) Avoid error calculating UTR on features that have no exon subfeatures ([@cmdcolin](https://github.com/cmdcolin))
  - [#1954](https://github.com/GMOD/jbrowse-components/pull/1954) Add more environments to configSchema create calls to fix ability to use custom jexl commands with main thread rendering ([@cmdcolin](https://github.com/cmdcolin))
  - [#1963](https://github.com/GMOD/jbrowse-components/pull/1963) Fix ability to use DialogComponent (used for svg export, pileup sort, etc) on embedded components ([@cmdcolin](https://github.com/cmdcolin))
  - [#1945](https://github.com/GMOD/jbrowse-components/pull/1945) Fix hic not being able to render due to incorrect lazy loading ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1956](https://github.com/GMOD/jbrowse-components/pull/1956) Fix connection behavior ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1966](https://github.com/GMOD/jbrowse-components/pull/1966) Fix ability to use add-track force on symlink tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1951](https://github.com/GMOD/jbrowse-components/pull/1951) Fix breakpoint split view demo configuration on website ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#2002](https://github.com/GMOD/jbrowse-components/pull/2002) Add @jbrowse/img to homepage ([@cmdcolin](https://github.com/cmdcolin))
- [#2007](https://github.com/GMOD/jbrowse-components/pull/2007) Update docs for modifications/methylation coloring, plugin store, and the sequence panel in feature details ([@cmdcolin](https://github.com/cmdcolin))
- [#1976](https://github.com/GMOD/jbrowse-components/pull/1976) reorganize the demo page to emphasize the cancer sv demo more ([@rbuels](https://github.com/rbuels))
- [#1952](https://github.com/GMOD/jbrowse-components/pull/1952) Add demo for 1000 genomes extended trio dataset to website ([@cmdcolin](https://github.com/cmdcolin))
- [#1862](https://github.com/GMOD/jbrowse-components/pull/1862) Add example for using a build-time included plugin to storybook ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#2003](https://github.com/GMOD/jbrowse-components/pull/2003) Make SNPCoverage independently generate the modifications tag-color mapping ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `development-tools`
  - [#1930](https://github.com/GMOD/jbrowse-components/pull/1930) Upgrade react scripts+react to latest versions ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#1125](https://github.com/GMOD/jbrowse-components/pull/1125) Export SVG ([@cmdcolin](https://github.com/cmdcolin))
  - [#1867](https://github.com/GMOD/jbrowse-components/pull/1867) Virtualized tree for tracklist to support having thousands of tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1660](https://github.com/GMOD/jbrowse-components/pull/1660) Allow connections to have multiple assemblies ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1864](https://github.com/GMOD/jbrowse-components/pull/1864) Add Material UI's DataGrid to re-exports ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1875](https://github.com/GMOD/jbrowse-components/pull/1875) Make drawer widget titles stay visible when scrolling inside the widget ([@cmdcolin](https://github.com/cmdcolin))
  - [#1877](https://github.com/GMOD/jbrowse-components/pull/1877) Add ability to copy the text produced by the feature details sequence panel to MS Word/Google Docs and preserve styling ([@cmdcolin](https://github.com/cmdcolin))
  - [#1854](https://github.com/GMOD/jbrowse-components/pull/1854) Make "About track" dialog available from tracklist and for non-LGV tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1853](https://github.com/GMOD/jbrowse-components/pull/1853) Add mouseovers in feature details that show field descriptions for VCF fields ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1892](https://github.com/GMOD/jbrowse-components/pull/1892) Create new JB2 plugin store ([@elliothershberg](https://github.com/elliothershberg))
  - [#1901](https://github.com/GMOD/jbrowse-components/pull/1901) Make using --out for add-assembly create output directory if it does not exist and fix outputting to symlink ([@cmdcolin](https://github.com/cmdcolin))
  - [#1850](https://github.com/GMOD/jbrowse-components/pull/1850) Add true breakend ALT strings to the feature details panel ([@cmdcolin](https://github.com/cmdcolin))
  - [#1878](https://github.com/GMOD/jbrowse-components/pull/1878) Add --delete to set-default-session, fix --session ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1861](https://github.com/GMOD/jbrowse-components/pull/1861) Change Alignments track "Fade mismatches by quality" setting to a separate config param and made it less strict ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#1924](https://github.com/GMOD/jbrowse-components/pull/1924) Fix import of BED and navToLocString from spreadsheet views ([@cmdcolin](https://github.com/cmdcolin))
  - [#1918](https://github.com/GMOD/jbrowse-components/pull/1918) Fix issue with some falsy values being hidden in feature details ([@cmdcolin](https://github.com/cmdcolin))
  - [#1911](https://github.com/GMOD/jbrowse-components/pull/1911) Fix breakpoint split view visualizations for files that need ref renaming (e.g. chr1 vs 1) ([@cmdcolin](https://github.com/cmdcolin))
  - [#1904](https://github.com/GMOD/jbrowse-components/pull/1904) Fix issue with synteny polygons displaying slightly offset ([@cmdcolin](https://github.com/cmdcolin))
  - [#1884](https://github.com/GMOD/jbrowse-components/pull/1884) Fix rIC ponyfill for use on Safari ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1912](https://github.com/GMOD/jbrowse-components/pull/1912) Fix reloading of local sessions when using React.StrictMode ([@cmdcolin](https://github.com/cmdcolin))
  - [#1900](https://github.com/GMOD/jbrowse-components/pull/1900) Make clicking away from autocomplete popup on track container work ([@cmdcolin](https://github.com/cmdcolin))
  - [#1878](https://github.com/GMOD/jbrowse-components/pull/1878) Add --delete to set-default-session, fix --session ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1871](https://github.com/GMOD/jbrowse-components/pull/1871) Fix crash on dotplot/linear synteny import form and when closing linear synteny track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1860](https://github.com/GMOD/jbrowse-components/pull/1860) Fix alignments read filter jexl syntax ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1914](https://github.com/GMOD/jbrowse-components/pull/1914) Use MDX to add proper image captions in web and pdf documentation ([@cmdcolin](https://github.com/cmdcolin))
- [#1855](https://github.com/GMOD/jbrowse-components/pull/1855) Add download page in website header and new super-quick-start guide ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- `core`
  - [#1932](https://github.com/GMOD/jbrowse-components/pull/1932) Update analytics and share API URLs to refer to more stable locations ([@peterkxie](https://github.com/peterkxie))
  - [#1888](https://github.com/GMOD/jbrowse-components/pull/1888) More lazy loading of react components to reduce bundle size ([@cmdcolin](https://github.com/cmdcolin))
  - [#1790](https://github.com/GMOD/jbrowse-components/pull/1790) Allow MainThreadRpcDriver to skip serialization during RPC, improving main-thread rendering performance ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#1926](https://github.com/GMOD/jbrowse-components/pull/1926) Update website to link to demos on cloudfront for better compression ([@cmdcolin](https://github.com/cmdcolin))
  - [#1868](https://github.com/GMOD/jbrowse-components/pull/1868) Export XYPlotRenderer and configSchema ([@elliothershberg](https://github.com/elliothershberg))
  - [#1863](https://github.com/GMOD/jbrowse-components/pull/1863) Update @gmod/indexedfasta ([@cmdcolin](https://github.com/cmdcolin))
  - [#1795](https://github.com/GMOD/jbrowse-components/pull/1795) Make LinearAlignmentsDisplay fully configurable in the UI ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1822](https://github.com/GMOD/jbrowse-components/pull/1822) Let React LGV navigate without setting displayedRegion first ([@garrettjstevens](https://github.com/garrettjstevens))

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
  - [#1846](https://github.com/GMOD/jbrowse-components/pull/1846) Improve copy+paste in the data grids for feature details ([@cmdcolin](https://github.com/cmdcolin))
  - [#1814](https://github.com/GMOD/jbrowse-components/pull/1814) Add ability to get promoter sequence and intron sequence for genes from the feature details panel ([@cmdcolin](https://github.com/cmdcolin))
  - [#1816](https://github.com/GMOD/jbrowse-components/pull/1816) Remove some animation effects ([@cmdcolin](https://github.com/cmdcolin))
  - [#1778](https://github.com/GMOD/jbrowse-components/pull/1778) Adds dropdown to show drawer widget stack ([@teresam856](https://github.com/teresam856))
  - [#1685](https://github.com/GMOD/jbrowse-components/pull/1685) Change callbacks language from JavaScript to Jexl ([@peterkxie](https://github.com/peterkxie))
- Other
  - [#1831](https://github.com/GMOD/jbrowse-components/pull/1831) Add dialog for launching breakpoint split view from variant feature details ([@cmdcolin](https://github.com/cmdcolin))
  - [#1803](https://github.com/GMOD/jbrowse-components/pull/1803) Transcript and gene glyphs can now display implied UTRs, active by default ([@cmdcolin](https://github.com/cmdcolin))
  - [#1808](https://github.com/GMOD/jbrowse-components/pull/1808) Add another heuristic for returning gene features from BigBed ([@cmdcolin](https://github.com/cmdcolin))
  - [#1774](https://github.com/GMOD/jbrowse-components/pull/1774) Add warning dialog in LGV before returning to import form to prevent accidentally losing the current view ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- `core`
  - [#1811](https://github.com/GMOD/jbrowse-components/pull/1811) Check for existence of window more robustly to allow in SSR or node applications ([@elliothershberg](https://github.com/elliothershberg))
  - [#1793](https://github.com/GMOD/jbrowse-components/pull/1793) Fix dotplot rendering outside it's allowed bounds ([@cmdcolin](https://github.com/cmdcolin))
  - [#1783](https://github.com/GMOD/jbrowse-components/pull/1783) Add hic aborting and fix remoteAbort signal propagation ([@cmdcolin](https://github.com/cmdcolin))
  - [#1723](https://github.com/GMOD/jbrowse-components/pull/1723) A few bugfixes ([@garrettjstevens](https://github.com/garrettjstevens))
- Other
  - [#1815](https://github.com/GMOD/jbrowse-components/pull/1815) Clear tracks when using "Return to import form" ([@cmdcolin](https://github.com/cmdcolin))
  - [#1819](https://github.com/GMOD/jbrowse-components/pull/1819) Standardized sentence casing on drawer widget titles ([@cmdcolin](https://github.com/cmdcolin))
  - [#1796](https://github.com/GMOD/jbrowse-components/pull/1796) Bump generic-filehandle for fixing CORS errors from Chrome cache pollution ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1824](https://github.com/GMOD/jbrowse-components/pull/1824) Add storybook docs page for nextjs usage ([@elliothershberg](https://github.com/elliothershberg))
- [#1770](https://github.com/GMOD/jbrowse-components/pull/1770) 1469 storybook deploy ([@elliothershberg](https://github.com/elliothershberg))
- [#1807](https://github.com/GMOD/jbrowse-components/pull/1807) Update developer guide to cover displays, and highlight working external plugins ([@cmdcolin](https://github.com/cmdcolin))
- [#1779](https://github.com/GMOD/jbrowse-components/pull/1779) Collaborative release announcement editing ([@rbuels](https://github.com/rbuels))
- [#1791](https://github.com/GMOD/jbrowse-components/pull/1791) Add a couple more demos for our live version with MDX ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#1820](https://github.com/GMOD/jbrowse-components/pull/1820) Create v1.1.0.md, draft of release announcements ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1823](https://github.com/GMOD/jbrowse-components/pull/1823) Add note about previewing changelog to CONTRIBUTING.md ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1834](https://github.com/GMOD/jbrowse-components/pull/1834) Change jbrowse-components monorepo default branch from 'master' to 'main' ([@rbuels](https://github.com/rbuels))

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
  - [#1758](https://github.com/GMOD/jbrowse-components/pull/1758) Add ability to get stitched together CDS, protein, and cDNA sequences in feature details ([@cmdcolin](https://github.com/cmdcolin))
  - [#1721](https://github.com/GMOD/jbrowse-components/pull/1721) Manually adjust feature height and spacing on alignments track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1728](https://github.com/GMOD/jbrowse-components/pull/1728) Add list of loaded plugins to the "About widget" ([@rbuels](https://github.com/rbuels))
  - [#1711](https://github.com/GMOD/jbrowse-components/pull/1711) Add plugin top-level configuration ([@teresam856](https://github.com/teresam856))
  - [#1699](https://github.com/GMOD/jbrowse-components/pull/1699) Add sequence track for both read and reference genome in the "Linear read vs ref" comparison ([@cmdcolin](https://github.com/cmdcolin))
  - [#1701](https://github.com/GMOD/jbrowse-components/pull/1701) Add clickable navigation links to supplementary alignments/paired ends locations and BND/TRA endpoints in detail widgets ([@cmdcolin](https://github.com/cmdcolin))
  - [#1601](https://github.com/GMOD/jbrowse-components/pull/1601) Add ability to color by per-base quality in alignment tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1640](https://github.com/GMOD/jbrowse-components/pull/1640) Move stats calculation to BaseFeatureAdapter ([@cmdcolin](https://github.com/cmdcolin))
  - [#1588](https://github.com/GMOD/jbrowse-components/pull/1588) Add "Get sequence" action to LGV rubber-band ([@teresam856](https://github.com/teresam856))
- Other
  - [#1743](https://github.com/GMOD/jbrowse-components/pull/1743) Add color picker and choice of summary score style for wiggle track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1763](https://github.com/GMOD/jbrowse-components/pull/1763) Add a "CSS reset" to jbrowse-react-linear-genome-view to prevent parent styles from outside the component leaking in ([@cmdcolin](https://github.com/cmdcolin))
  - [#1756](https://github.com/GMOD/jbrowse-components/pull/1756) Split alignments track menu items into "Pileup" and "SNPCoverage" submenus ([@cmdcolin](https://github.com/cmdcolin))
  - [#1742](https://github.com/GMOD/jbrowse-components/pull/1742) Add ability to display crosshatches on the wiggle line/xyplot renderer ([@cmdcolin](https://github.com/cmdcolin))
  - [#1736](https://github.com/GMOD/jbrowse-components/pull/1736) Fix CLI add-track --load inPlace to put exact contents into the config, add better CLI example docs ([@cmdcolin](https://github.com/cmdcolin))
  - [#1394](https://github.com/GMOD/jbrowse-components/pull/1394) Add new menu items for show/hide feature labels, set max height, and set compact display mode ([@cmdcolin](https://github.com/cmdcolin))
  - [#1720](https://github.com/GMOD/jbrowse-components/pull/1720) Standardize phred qual scaling between BAM and CRAM and add option to make mismatches render in a lighter color when quality is low ([@cmdcolin](https://github.com/cmdcolin))
  - [#1704](https://github.com/GMOD/jbrowse-components/pull/1704) Add "Show all regions in assembly" to import form and make import form show entire region when refName selected ([@cmdcolin](https://github.com/cmdcolin))
  - [#1687](https://github.com/GMOD/jbrowse-components/pull/1687) Threshold for indicators on SNPCoverage + inverted bargraph of interbase counts for sub-threshold events ([@cmdcolin](https://github.com/cmdcolin))
  - [#1695](https://github.com/GMOD/jbrowse-components/pull/1695) Improve zoomed-out display of quantitative displays tracks when bicolor pivot is active ([@cmdcolin](https://github.com/cmdcolin))
  - [#1680](https://github.com/GMOD/jbrowse-components/pull/1680) Add on click functionality to quantitative track features ([@teresam856](https://github.com/teresam856))
  - [#1630](https://github.com/GMOD/jbrowse-components/pull/1630) Get column names from BED tabix files and other utils for external jbrowse-plugin-gwas support ([@cmdcolin](https://github.com/cmdcolin))
  - [#1709](https://github.com/GMOD/jbrowse-components/pull/1709) Improve sorting and filtering in variant detail widget ([@cmdcolin](https://github.com/cmdcolin))
  - [#1688](https://github.com/GMOD/jbrowse-components/pull/1688) Bold insertion indicator for large insertions on pileup track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1669](https://github.com/GMOD/jbrowse-components/pull/1669) Allow plain json encoding of the session in the URL ([@cmdcolin](https://github.com/cmdcolin))
  - [#1642](https://github.com/GMOD/jbrowse-components/pull/1642) Enable locstring navigation from LGV import form ([@teresam856](https://github.com/teresam856))
  - [#1655](https://github.com/GMOD/jbrowse-components/pull/1655) Add GFF3Tabix and BEDTabix inference to JB1 connection ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1643](https://github.com/GMOD/jbrowse-components/pull/1643) Add an offset that allows all wiggle y-scalebar labels to be visible ([@cmdcolin](https://github.com/cmdcolin))
  - [#1632](https://github.com/GMOD/jbrowse-components/pull/1632) Displays warnings when receiving a session with custom callbacks ([@peterkxie](https://github.com/peterkxie))
  - [#1615](https://github.com/GMOD/jbrowse-components/pull/1615) Increase pileup maxHeight ([@cmdcolin](https://github.com/cmdcolin))
  - [#1624](https://github.com/GMOD/jbrowse-components/pull/1624) GCContent adapter ([@cmdcolin](https://github.com/cmdcolin))
  - [#1614](https://github.com/GMOD/jbrowse-components/pull/1614) Add insertion and clip indicators to SNPCoverage views (part of Alignments tracks) ([@cmdcolin](https://github.com/cmdcolin))
  - [#1610](https://github.com/GMOD/jbrowse-components/pull/1610) Display error message from dynamodb session sharing error ([@cmdcolin](https://github.com/cmdcolin))

#### :bug: Bug Fix

- Other
  - [#1777](https://github.com/GMOD/jbrowse-components/pull/1777) Quick fix for block error ([@cmdcolin](https://github.com/cmdcolin))
  - [#1748](https://github.com/GMOD/jbrowse-components/pull/1748) External plugins load after confirming config warning ([@peterkxie](https://github.com/peterkxie))
  - [#1750](https://github.com/GMOD/jbrowse-components/pull/1750) Fix pileup sorting when using string tag ([@cmdcolin](https://github.com/cmdcolin))
  - [#1747](https://github.com/GMOD/jbrowse-components/pull/1747) Fix the position of the popup menu after rubberband select when there is a margin on the component e.g. in embedded ([@cmdcolin](https://github.com/cmdcolin))
  - [#1736](https://github.com/GMOD/jbrowse-components/pull/1736) Fix CLI add-track --load inPlace to put exact contents into the config, add better CLI example docs ([@cmdcolin](https://github.com/cmdcolin))
  - [#1731](https://github.com/GMOD/jbrowse-components/pull/1731) Fix alignment track ability to remember the height of the SNPCoverage subtrack on refresh ([@cmdcolin](https://github.com/cmdcolin))
  - [#1719](https://github.com/GMOD/jbrowse-components/pull/1719) Fix for navigation past end of chromosome ([@cmdcolin](https://github.com/cmdcolin))
  - [#1698](https://github.com/GMOD/jbrowse-components/pull/1698) Fix rendering read vs ref comparisons with CIGAR strings that use = sign matches ([@cmdcolin](https://github.com/cmdcolin))
  - [#1697](https://github.com/GMOD/jbrowse-components/pull/1697) Fix softclipping configuration setting causing bases to be missed ([@cmdcolin](https://github.com/cmdcolin))
  - [#1689](https://github.com/GMOD/jbrowse-components/pull/1689) Disable copy/delete menu items for reference sequence track ([@teresam856](https://github.com/teresam856))
  - [#1682](https://github.com/GMOD/jbrowse-components/pull/1682) Fix parsing of BED and BEDPE files with comment header for spreadsheet view ([@cmdcolin](https://github.com/cmdcolin))
  - [#1679](https://github.com/GMOD/jbrowse-components/pull/1679) Fix issue with using launching the add track widget on views that are not displaying any regions ([@teresam856](https://github.com/teresam856))
  - [#1642](https://github.com/GMOD/jbrowse-components/pull/1642) Enable locstring navigation from LGV import form ([@teresam856](https://github.com/teresam856))
  - [#1626](https://github.com/GMOD/jbrowse-components/pull/1626) Bug Fix: specify assembly in locstring ([@teresam856](https://github.com/teresam856))
  - [#1619](https://github.com/GMOD/jbrowse-components/pull/1619) Fix overview scale polygon not appearing properly in some cases ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1714](https://github.com/GMOD/jbrowse-components/pull/1714) Fix ability to add a PAF on initial dotplot view creation ([@cmdcolin](https://github.com/cmdcolin))
  - [#1657](https://github.com/GMOD/jbrowse-components/pull/1657) Fix for track using assembly alias not displaying ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1620](https://github.com/GMOD/jbrowse-components/pull/1620) Add error reporting on a worker failure ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1725](https://github.com/GMOD/jbrowse-components/pull/1725) JBrowseR release ([@elliothershberg](https://github.com/elliothershberg))
- [#1677](https://github.com/GMOD/jbrowse-components/pull/1677) Config guide updates ([@elliothershberg](https://github.com/elliothershberg))
- [#1665](https://github.com/GMOD/jbrowse-components/pull/1665) Add Nextstrain COVID storybook ([@elliothershberg](https://github.com/elliothershberg))
- [#1670](https://github.com/GMOD/jbrowse-components/pull/1670) typo in developer guide docs ([@teresam856](https://github.com/teresam856))
- [#1592](https://github.com/GMOD/jbrowse-components/pull/1592) Website copy edits ([@rbuels](https://github.com/rbuels))
- [#1646](https://github.com/GMOD/jbrowse-components/pull/1646) Fix "See code" link in CLI docs ([@garrettjstevens](https://github.com/garrettjstevens))
- [#1618](https://github.com/GMOD/jbrowse-components/pull/1618) Add whole-genome view and color/sort alignments tutorials to user guide ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- Other
  - [#1666](https://github.com/GMOD/jbrowse-components/pull/1666) Move "mouseover" config from BaseLinearDisplay to LinearBasicDisplay display ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1751](https://github.com/GMOD/jbrowse-components/pull/1751) Make the variant display derive from the feature display ([@cmdcolin](https://github.com/cmdcolin))
  - [#1716](https://github.com/GMOD/jbrowse-components/pull/1716) Stringify labels before adding to rendering to avoid undefineds on label.length ([@cmdcolin](https://github.com/cmdcolin))
  - [#1713](https://github.com/GMOD/jbrowse-components/pull/1713) Add console.error log in block setError ([@cmdcolin](https://github.com/cmdcolin))
  - [#1663](https://github.com/GMOD/jbrowse-components/pull/1663) Make LGV "initialized" not depend on displayedRegions ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1672](https://github.com/GMOD/jbrowse-components/pull/1672) Fix import forms crashing if there are no assemblies ([@cmdcolin](https://github.com/cmdcolin))
  - [#1644](https://github.com/GMOD/jbrowse-components/pull/1644) Bump electron from 9.3.1 to 9.4.0 ([@dependabot[bot]](https://github.com/apps/dependabot))
  - [#1641](https://github.com/GMOD/jbrowse-components/pull/1641) Remove codecov pr annotations ([@cmdcolin](https://github.com/cmdcolin))
  - [#1609](https://github.com/GMOD/jbrowse-components/pull/1609) Add extra checks for release script ([@peterkxie](https://github.com/peterkxie))
- `core`
  - [#1762](https://github.com/GMOD/jbrowse-components/pull/1762) Add requestidlecallback ponyfill in @jbrowse/core/util ([@cmdcolin](https://github.com/cmdcolin))
  - [#1629](https://github.com/GMOD/jbrowse-components/pull/1629) Add RegionsAdapter/SequenceAdapter, reorganize base adapters ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1625](https://github.com/GMOD/jbrowse-components/pull/1625) Make renderArgs consistent and don't duplicate data ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1414](https://github.com/GMOD/jbrowse-components/pull/1414) Typescriptify and MST'ify the add track workflow ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#1560](https://github.com/GMOD/jbrowse-components/pull/1560) Provide a dialog to add extra genomic context for linear read vs. ref visualization ([@elliothershberg](https://github.com/elliothershberg))
  - [#1604](https://github.com/GMOD/jbrowse-components/pull/1604) Add ability to filter for read name to the alignments filter dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#1599](https://github.com/GMOD/jbrowse-components/pull/1599) Replace 'show all regions' with 'show all regions in assembly' ([@cmdcolin](https://github.com/cmdcolin))
  - [#1595](https://github.com/GMOD/jbrowse-components/pull/1595) Admin server GUI enhancements ([@elliothershberg](https://github.com/elliothershberg))
  - [#1584](https://github.com/GMOD/jbrowse-components/pull/1584) Restructure demo page and release cancer demo ([@elliothershberg](https://github.com/elliothershberg))
  - [#1579](https://github.com/GMOD/jbrowse-components/pull/1579) Create --branch and --nightly flags for `jbrowse create` and `jbrowse upgrade` commands ([@cmdcolin](https://github.com/cmdcolin))
  - [#1575](https://github.com/GMOD/jbrowse-components/pull/1575) Improve mobx-state-tree type validation errors ([@cmdcolin](https://github.com/cmdcolin))
  - [#1574](https://github.com/GMOD/jbrowse-components/pull/1574) Make softclip indicator black if no seq available ([@cmdcolin](https://github.com/cmdcolin))
  - [#1554](https://github.com/GMOD/jbrowse-components/pull/1554) Coloring options with simple color for tag ([@peterkxie](https://github.com/peterkxie))
  - [#1565](https://github.com/GMOD/jbrowse-components/pull/1565) Rename jbrowse cli add-track --type to --trackType ([@cmdcolin](https://github.com/cmdcolin))
  - [#1558](https://github.com/GMOD/jbrowse-components/pull/1558) Add docs for sequence track, variant track, launching synteny from dotplot, and add UCSC plugin to demo ([@cmdcolin](https://github.com/cmdcolin))
  - [#1533](https://github.com/GMOD/jbrowse-components/pull/1533) Display file headers in pre tag in about dialogs and bump @gmod/bam and @gmod/tabix package versions ([@cmdcolin](https://github.com/cmdcolin))
  - [#1541](https://github.com/GMOD/jbrowse-components/pull/1541) Add more info about adding a PAF file to the synteny import form ([@cmdcolin](https://github.com/cmdcolin))
  - [#1509](https://github.com/GMOD/jbrowse-components/pull/1509) Combine Search and Dropdown component on LGV ([@teresam856](https://github.com/teresam856))
  - [#1530](https://github.com/GMOD/jbrowse-components/pull/1530) Add spreadsheet filter support for derived columns ([@elliothershberg](https://github.com/elliothershberg))
  - [#1483](https://github.com/GMOD/jbrowse-components/pull/1483) Add session export to and import from file ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1519](https://github.com/GMOD/jbrowse-components/pull/1519) Add autoSql to the bigBed "About this track" dialog ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1531](https://github.com/GMOD/jbrowse-components/pull/1531) Add track menu options for autoscale, log scale, histogram fill, setting min/max score, and zoom level/resolution for wiggle/snpcoverage tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1473](https://github.com/GMOD/jbrowse-components/pull/1473) Color, filter, and sort options for the alignments ([@cmdcolin](https://github.com/cmdcolin))
  - [#1576](https://github.com/GMOD/jbrowse-components/pull/1576) Add location string to tooltip for wiggle and SNPCoverage tracks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1529](https://github.com/GMOD/jbrowse-components/pull/1529) Display subfeatures in feature details widget ([@cmdcolin](https://github.com/cmdcolin))
- `core`, `development-tools`
  - [#1578](https://github.com/GMOD/jbrowse-components/pull/1578) Update build system for external plugins ([@garrettjstevens](https://github.com/garrettjstevens))

#### :bug: Bug Fix

- Other
  - [#1608](https://github.com/GMOD/jbrowse-components/pull/1608) Take into account offsetX of the rubberband on scalebar zooming ([@cmdcolin](https://github.com/cmdcolin))
  - [#1597](https://github.com/GMOD/jbrowse-components/pull/1597) Fix crash when there are undefined references in the state tree e.g. when a track is deleted but still referred to by a session ([@peterkxie](https://github.com/peterkxie))
  - [#1598](https://github.com/GMOD/jbrowse-components/pull/1598) Disable 'copy to clipboard' while share url being generated ([@peterkxie](https://github.com/peterkxie))
  - [#1589](https://github.com/GMOD/jbrowse-components/pull/1589) Fix the display of trackhub registry results ([@cmdcolin](https://github.com/cmdcolin))
  - [#1573](https://github.com/GMOD/jbrowse-components/pull/1573) Update hic-straw to fix error for hic files with many scaffolds ([@cmdcolin](https://github.com/cmdcolin))
  - [#1563](https://github.com/GMOD/jbrowse-components/pull/1563) Remove softclip and hardclip from being counted as SNPs in the SNPCoverage ([@cmdcolin](https://github.com/cmdcolin))
  - [#1559](https://github.com/GMOD/jbrowse-components/pull/1559) Avoid errors from breakpoint split view related to getBoundingClientRect on null track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1540](https://github.com/GMOD/jbrowse-components/pull/1540) Fix memory leak when side scrolling LGV blocks ([@cmdcolin](https://github.com/cmdcolin))
  - [#1534](https://github.com/GMOD/jbrowse-components/pull/1534) Fix breakpoint split view showing too many connections for paired end ends ([@cmdcolin](https://github.com/cmdcolin))
  - [#1524](https://github.com/GMOD/jbrowse-components/pull/1524) Move loading flag for spreadsheet import wizard to volatile to avoid it persisting across refresh ([@cmdcolin](https://github.com/cmdcolin))
  - [#1521](https://github.com/GMOD/jbrowse-components/pull/1521) Add missing dep to react-linear-genome-view ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1587](https://github.com/GMOD/jbrowse-components/pull/1587) Fix positioning of scalebar tooltips, overview scalebar plotting, and refName label positioning when displaying many regions ([@cmdcolin](https://github.com/cmdcolin))
  - [#1547](https://github.com/GMOD/jbrowse-components/pull/1547) Fix analytics crashing when using plugins ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1594](https://github.com/GMOD/jbrowse-components/pull/1594) Add GFF3 example to quickstart ([@cmdcolin](https://github.com/cmdcolin))
- [#1581](https://github.com/GMOD/jbrowse-components/pull/1581) Add some features that are missing from jbrowse 2 to the feature comparison table ([@cmdcolin](https://github.com/cmdcolin))
- [#1558](https://github.com/GMOD/jbrowse-components/pull/1558) Add docs for sequence track, variant track, launching synteny from dotplot, and add UCSC plugin to demo ([@cmdcolin](https://github.com/cmdcolin))
- [#1537](https://github.com/GMOD/jbrowse-components/pull/1537) Add CONTRIBUTING.md with tips for getting started with codebase ([@cmdcolin](https://github.com/cmdcolin))

#### :house: Internal

- [#1606](https://github.com/GMOD/jbrowse-components/pull/1606) Upgrade @testing-library/react and improve test reliability ([@cmdcolin](https://github.com/cmdcolin))
- [#1555](https://github.com/GMOD/jbrowse-components/pull/1555) Remove the TextDecoder/TextEncoder polyfill ([@cmdcolin](https://github.com/cmdcolin))
- [#1522](https://github.com/GMOD/jbrowse-components/pull/1522) Update oclif and remove now unnecessary file copy ([@garrettjstevens](https://github.com/garrettjstevens))

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
  - [#1513](https://github.com/GMOD/jbrowse-components/pull/1513) Add a custom scrollbar that overrides the auto-hiding behavior of scrollbars on OSX ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- Other
  - [#1514](https://github.com/GMOD/jbrowse-components/pull/1514) react-linear-genome-view bug fixes ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1517](https://github.com/GMOD/jbrowse-components/pull/1517) Fix the use of filtering display on desktop ([@cmdcolin](https://github.com/cmdcolin))
  - [#1512](https://github.com/GMOD/jbrowse-components/pull/1512) Fix setting maxDisplayedBpPerPx for pileup display, helps prevent too large an area from being rendered ([@cmdcolin](https://github.com/cmdcolin))
  - [#1442](https://github.com/GMOD/jbrowse-components/pull/1442) Change track selector togglebutton to normal button ([@cmdcolin](https://github.com/cmdcolin))
  - [#1506](https://github.com/GMOD/jbrowse-components/pull/1506) Fix horizontally flipped translation frames position ([@cmdcolin](https://github.com/cmdcolin))
  - [#1501](https://github.com/GMOD/jbrowse-components/pull/1501) Fix CLI to allow jbrowse create to download newer monorepo tag format ([@cmdcolin](https://github.com/cmdcolin))
- `core`
  - [#1505](https://github.com/GMOD/jbrowse-components/pull/1505) Fix loading of local files in jbrowse-desktop ([@cmdcolin](https://github.com/cmdcolin))

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
  - [#1462](https://github.com/GMOD/jbrowse-components/pull/1462) Allow importing gzip and bgzip files in the spreadsheet and SV inspector ([@cmdcolin](https://github.com/cmdcolin))
  - [#1460](https://github.com/GMOD/jbrowse-components/pull/1460) Add support for more bigBed subtypes and fallback for unsupported types ([@peterkxie](https://github.com/peterkxie))
  - [#1455](https://github.com/GMOD/jbrowse-components/pull/1455) Add the ability to use connection across refreshes in jbrowse-web using session connections ([@peterkxie](https://github.com/peterkxie))
  - [#1439](https://github.com/GMOD/jbrowse-components/pull/1439) 1381 improve assembly add form ([@elliothershberg](https://github.com/elliothershberg))
  - [#1433](https://github.com/GMOD/jbrowse-components/pull/1433) Make add track warning a bit more lenient ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1420](https://github.com/GMOD/jbrowse-components/pull/1420) Add the assembly manager feature to jbrowse-desktop ([@elliothershberg](https://github.com/elliothershberg))
- `core`
  - [#1458](https://github.com/GMOD/jbrowse-components/pull/1458) Add three frame translation to the sequence track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1453](https://github.com/GMOD/jbrowse-components/pull/1453) Change "Factory reset" to "Reset session" in jbrowse-web ([@teresam856](https://github.com/teresam856))
  - [#1441](https://github.com/GMOD/jbrowse-components/pull/1441) New icon for the track selector ([@cmdcolin](https://github.com/cmdcolin))
  - [#1438](https://github.com/GMOD/jbrowse-components/pull/1438) Improve assembly loading time by moving to main thread ([@cmdcolin](https://github.com/cmdcolin))
  - [#1434](https://github.com/GMOD/jbrowse-components/pull/1434) Create separate config schema for ReferenceSequenceTrack ([@elliothershberg](https://github.com/elliothershberg))

#### :bug: Bug Fix

- `core`
  - [#1491](https://github.com/GMOD/jbrowse-components/pull/1491) Fix ability to add a PAF synteny track with add-track ([@cmdcolin](https://github.com/cmdcolin))
  - [#1470](https://github.com/GMOD/jbrowse-components/pull/1470) Avoid rendering the literal string 'null' in the feature details ([@cmdcolin](https://github.com/cmdcolin))
- Other
  - [#1489](https://github.com/GMOD/jbrowse-components/pull/1489) Fix long read vs ref CIGAR rendering for horizontally flipped synteny view ([@cmdcolin](https://github.com/cmdcolin))
  - [#1460](https://github.com/GMOD/jbrowse-components/pull/1460) Add support for more bigBed subtypes and fallback for unsupported types ([@peterkxie](https://github.com/peterkxie))
  - [#1472](https://github.com/GMOD/jbrowse-components/pull/1472) Wait on assemblies that are being tracked by the assemblyManager only ([@cmdcolin](https://github.com/cmdcolin))
  - [#1466](https://github.com/GMOD/jbrowse-components/pull/1466) Avoid rendering the display and renderer settings in the about this track dialog ([@cmdcolin](https://github.com/cmdcolin))
  - [#1461](https://github.com/GMOD/jbrowse-components/pull/1461) Fix usage of jbrowse-cli on node 10.9 related to fs.promises ([@cmdcolin](https://github.com/cmdcolin))
  - [#1452](https://github.com/GMOD/jbrowse-components/pull/1452) Bug: search box disappears from LGV header on smaller widths ([@teresam856](https://github.com/teresam856))
  - [#1432](https://github.com/GMOD/jbrowse-components/pull/1432) Make global variables window.JBrowseSession and window.JBrowseRootModel available in jbrowse-web ([@teresam856](https://github.com/teresam856))
  - [#1431](https://github.com/GMOD/jbrowse-components/pull/1431) Fix connection tracks not showing up in track selector ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1428](https://github.com/GMOD/jbrowse-components/pull/1428) Fix the listVersions behavior of the jbrowse-cli returning duplicate entries ([@cmdcolin](https://github.com/cmdcolin))
  - [#1422](https://github.com/GMOD/jbrowse-components/pull/1422) Fix crash from empty ALT field in VCF ([@cmdcolin](https://github.com/cmdcolin))
  - [#1413](https://github.com/GMOD/jbrowse-components/pull/1413) Fix ability to add CRAM tracks using the web based add-track GUI ([@cmdcolin](https://github.com/cmdcolin))

#### :memo: Documentation

- [#1435](https://github.com/GMOD/jbrowse-components/pull/1435) Updates to quickstart guides ([@garrettjstevens](https://github.com/garrettjstevens))

#### :house: Internal

- Other
  - [#1437](https://github.com/GMOD/jbrowse-components/pull/1437) Use lerna-changelog for changelog generation ([@cmdcolin](https://github.com/cmdcolin))
  - [#1465](https://github.com/GMOD/jbrowse-components/pull/1465) Establish minimum node version of 10.4 for using jbrowse-cli tools ([@cmdcolin](https://github.com/cmdcolin))
  - [#1454](https://github.com/GMOD/jbrowse-components/pull/1454) Fix GH workflow build ([@elliothershberg](https://github.com/elliothershberg))
  - [#1448](https://github.com/GMOD/jbrowse-components/pull/1448) Move building and testing from Travis to GitHub Workflow ([@garrettjstevens](https://github.com/garrettjstevens))
  - [#1450](https://github.com/GMOD/jbrowse-components/pull/1450) Fix website build ([@garrettjstevens](https://github.com/garrettjstevens))
- `core`
  - [#1468](https://github.com/GMOD/jbrowse-components/pull/1468) Have assembly manager get plugin manager from factory function args ([@garrettjstevens](https://github.com/garrettjstevens))

#### Committers: 5

- Colin Diesh ([@cmdcolin](https://github.com/cmdcolin))
- Elliot Hershberg ([@elliothershberg](https://github.com/elliothershberg))
- Garrett Stevens ([@garrettjstevens](https://github.com/garrettjstevens))
- Teresa Martinez ([@teresam856](https://github.com/teresam856))
- [@peterkxie](https://github.com/peterkxie)
