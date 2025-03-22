---
title: 2024 year in review
date: 2025-02-13
---

Hello all,

I know we are well into 2025 already, but I wanted to review some of the great
progress JBrowse made in 2024!

Without further ado, here are some highlights

## New multi-sample VCF displays

To help render population-scale data, we created new "multi-variant" rendering
modes. This includes a "matrix" rendering mode that is a dense visualization of
variation patterns.

This was an exciting development that has created a flurry of feature
development

One particularly interesting feature is the "phased rendering mode", which can
split the phased genotypes into separate rows, which effectively shows the
individual haplotypes.

The "phased rendering mode" has the unique ability to help spot patterns of
inheritance in e.g. trio datasets. You can visually see where a child inherited
particular variants from a particular parent

![](https://github.com/user-attachments/assets/a9308a40-ab74-48c0-9ab6-035b50a1ae0b)

The data in the multi-variant display can be sorted according to sample
metadata, which can be imported from a "samples TSV", so users can group and
color the samples by e.g. the population code (here showing 1000 genomes data)

![](https://github.com/user-attachments/assets/ba7b99ab-53eb-4719-a6de-1cf9ff16511a)

## Multi-way synteny views

We created the basis for rendering multi-way synteny views. Currently, this is
based on "series of pairwise" comparison rendering, which has certain drawbacks
(it is not a true multi-way comparison) but it is a big stepping stone

![](https://github.com/user-attachments/assets/4df008cb-13d4-44e0-b1c1-44bfbbc7c34a)

We intend to create more improvements allowing users to load multi-way
comparisons from a single data file, and easier UI workflows for setting up
multi-way views in the future

## Inversion SVs enhancements for breakpoint split view

We created new enhancements to the breakpoint split view to allow it to work
better in a 'single row' configuration, and to color reads by pair orientation
or by changes in direction in a split alignment

![](https://github.com/user-attachments/assets/cacdf84e-6fad-43f3-9fc4-9705709d7d89)

Screenshot showing read pairs being connected from a variety of sequencing runs
from Illumina, PacBio, and Nanopore from the Genome in a Bottle dataset

Note: There were many other improvements to the breakpoint split view including,
importantly, the ability to launch it from non-SV-inspector workflows.
Previously, the SV inspector was the only way to really launch a breakpoint
split view, but now it can be launched from just clicking the feature details of
a read or VCF feature.

## New "SV inspector" improvements

- Allows opening tracks from the config.json in the SV inspector and spreadsheet
- Uses @mui/x-data-grid for display of the spreadsheet
- Makes separate columns for VCF INFO fields
- Support larger files by storing data in 'volatile' storage that doesn't bog
  down the session
- Support DEL, INV, and all types of SVs instead of just TRA and BND type
  variants in the SV inspector
- Re-navigates existing breakpoint split view instead of launching a new one
  each time

![](https://github.com/user-attachments/assets/4ed49ee9-c844-424a-80fa-953b52d02967)

Screenshot showing the new SV inspector user interface

## New "Recent sessions" menu with autosaves

We saw users have trouble where they would close their tab containing JBrowse 2
and they would lose their work.

It would be difficult to restore where they were at

To help this situation, we created a new system where sessions are AUTOSAVED!
Yes, autosaved! So if you accidentally close a tab or come back the next day, it
is easy for you to go back and restore where you were at:

![](https://github.com/user-attachments/assets/08f05b2a-6426-45b9-96ba-edcc14bb5ae2)

Screenshot showing the ability to access "File->Recent sessions"

- You can also create "Favorite" sessions to revisit for later
- Admins can also create "Pre-configured" sessions for their users

If you have any feedback about this feature let us know. I think the
discoverability of this feature could use more improvement

## New "Group by" functionality for alignments tracks

We released new "Group by" functionality for the alignments tracks. This
functionality is somewhat unique because applying it creates multiple
functionally independent subtracks.

The effect of being split into independent subtracks is actually different from
e.g. the Group by feature in IGV, because in IGV, only the "read stack" is split
into different rows, whereas with JBrowse, each group gets its own read stack
and coverage calculation

![image8](https://github.com/user-attachments/assets/b4ddb20c-9b34-473c-a223-039cdf65bca5)

Example with splitting an alignments track by the HP tag

## Apollo 3 beta release

Apollo 3, the genome annotation editor built on JBrowse 2, went into public beta
at the end of 2024!

See release announcement here
https://github.com/GMOD/Apollo3/releases/tag/v0.3.0

The Apollo 3 editor can run as a 'collaboration server' (shared annotation
editing on a website) or as a standalone JBrowse 2 desktop plugin. It is able to
take full advantage of JBrowse 2 capabilities, and users can annotate e.g.
inside of a synteny view

![image](https://github.com/user-attachments/assets/7ab19499-57a0-4c71-8014-cbb749f91b04)

Feel free to get in touch for more information on the project!

## The year ahead

We look forward to hear from more users. Our office hours outreach effort has
been very successful with over 100 one-on-one meetings with users! Feel free to
sign up for one at https://jbrowse.org/jb2/contact :)
