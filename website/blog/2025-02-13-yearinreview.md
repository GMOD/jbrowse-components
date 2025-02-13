---
title: 2024 year in review
date: 2025-02-13
---

Hello all,

I know we are well into 2025 already, but I wanted to review some of the great
progress JBrowse made in 2024!

Without further ado, here are some highlights

## Multi-way synteny views

We created the basis for rendering multi-way synteny views. Currently, this is
based on "series of pairwise" comparison rendering, which has certain drawbacks
(it is not a true multi-way comparison) but it is a big stepping stone

![](https://github.com/user-attachments/assets/4df008cb-13d4-44e0-b1c1-44bfbbc7c34a)

Further improvements improved the user interface for importing "synteny tracks",
and setting up multi-way synteny views

![](https://github.com/user-attachments/assets/75da5058-50cc-413e-aee9-e57362d2d0c0)

We anticipate more improvements allowing users to load multi-way comparisons
from a single data file, and easier UI workflows for setting up multi-way views

## Improved rendering of inversion SVs in the breakpoint split view

We created new enhancements to the breakpoint split view to allow it to work
better in a 'single row' configuration, and to color reads by e.g. their pair
orientation, or by changes in direction in a split alignment

![](https://github.com/user-attachments/assets/cacdf84e-6fad-43f3-9fc4-9705709d7d89)

Screenshot showing read pairs being connected from a variety of sequencing runs
from Illumina, PacBio, and Nanopore from the Genome in a Bottle dataset

Note: There were many other aimprovements to the breakpoint split view
including, importantly, the ability to launch it from non-SV-inspector
workflows. Previously, the SV inspector was the only way to really launch a
breakpoint split view, but now it can be launched from just clicking the feature
details of a read or VCF feature.

![](https://github.com/GMOD/jbrowse-components/assets/6511937/dcd37230-5992-4663-8fdb-f56ecf662fcd)

## New SV inspector improvements

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

## Improved ability to access recent sessions

We saw many users have trouble where they would close their tab containing
JBrowse 2 and they would lose their work. It would be difficult to restore where
they were at

To help this situation, we created a new system where sessions are AUTOSAVED!
Yes, autosaved! It uses IndexedDB which has generous storage limits

So if you accidentally close a tab, it is easy for you to go back and restore
where you were at:

![](https://github.com/user-attachments/assets/08f05b2a-6426-45b9-96ba-edcc14bb5ae2)

Screenshot showing the ability to access "File->Recent sessions"

- You can also create "Favorite" sessions to revisit for later
- Admins can also create "Pre-configured" sessions for their users

If you have any feedback about this feature let us know. I think the
discoverability of this feature could use more improvement

## "Group by" for alignments tracks

We released new "Group by" functionality for the alignments tracks. This
functionality is somewhat unique because applying it creates multiple
functionally independent subtracks

![image8](https://github.com/user-attachments/assets/b4ddb20c-9b34-473c-a223-039cdf65bca5)

Example with splitting a alignments track by the HP tag

## Apollo 3 beta release

Apollo 3, the genome annotation editor built on JBrowse 2, went into public beta
at the end of 2024!

See release announcement here
https://github.com/GMOD/Apollo3/releases/tag/v0.3.0

The Apollo 3 editor can run as a 'collaboration server' (shared annotation
editing on a website) or as a standalone JBrowse 2 desktop plugin

We are very interested to hear any feedback from users

## New plugins!

Continued improvements, or new plugins, listed below!

- https://github.com/cmdcolin/jbrowse-plugin-graphgenomeviewer/
- https://github.com/cmdcolin/jbrowse-plugin-ldviewer
- https://github.com/cmdcolin/jbrowse-plugin-mafviewer (added phylogenetic tree)
- https://github.com/cmdcolin/jbrowse-plugin-gwas (added interactive mouseovers)
- https://github.com/gringer/jbrowse-plugin-repaver

![](https://github.com/user-attachments/assets/03ec2b20-1238-4832-93a0-ea1504a2e562)

The GWAS plugin, showing the mouseover of particular variants

## Looking forward!

We look forward to the new year, and thank everyone for their support, bug
reports, and participation
