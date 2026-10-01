---
name: hosting
description: What traps govern JBrowse's hosted assets — the jbrowse.org bucket and CloudFront, the content-addressed figure store, hosted genomes and PIF tiers, plugins served off jbrowse.org? Read before uploading or citing a hosted URL.
audience: internal
kind: operations
---

# Hosted assets and how they are published

## Bucket and CDN

Origin `s3://jbrowse.org`, fronted by CloudFront `E13LGELJOT4GQO`.

**An upload is not a publish.** After `aws s3 cp` the plain URL keeps serving the
cached object, and the app and screenshot generator use the plain URL, so the old
config loads silently ("Could not resolve identifier `<new_trackId>`" over an empty
band). `scripts/deploy-demo.sh <local-file> <demos-relative-path>` copies,
invalidates and sets the JSON content-type. Wait for the plain URL to reflect the
change before regenerating anything that reads it.

## Figure and media stores

`website/static/img/` and `products/jbrowse-img`'s `img/` are gitignored. Bytes
live at `s3://jbrowse.org/jb2-figures/<name>.<sha256[0:12]>.<ext>`; git tracks
`figures.lock`. CLI: `website/scripts/figures.ts` (`pnpm figures`, `:pull`,
`:push`). **Never delete from the store, including orphans**: URLs get pasted into
issues and papers. There is deliberately no `gc`.

## Hosted genomes and the launch surface

- **The hosted UCSC hg19 hub already carries the usual annotation tracks**,
  referenced by `trackId` with no session track. Check
  `jbrowse.org/ucsc/hg19/config.json` before adding one to a spec.
- **UCSC downloads are `hgdownload.soe.ucsc.edu`, never `hgdownload.cse.ucsc.edu`.**
  UCSC's reissued cert dropped the `cse` SAN, so HTTPS fails
  `ERR_CERT_COMMON_NAME_INVALID` and an assembly refuses to load ("Failed to fetch
  … chromAlias.txt").
- **`&loc=` accepts a gene name; a session spec's `init.loc` does not.** The URL
  param routes through text search; `navToLocString` rejects a non-locstring.

## Hosted PIFs and the coarse tier

- **A file with no `#pif` header predates the coarse CIGAR.** Its coarse rows lack
  the `cr:Z:` tag (ADR-104) and draw as plain ribbons. Header version 2 adds the
  `pi:i:` id a selection holds across the tier switch. A JBrowse older than the
  coarse CIGAR draws a rebuilt file's coarse rows as single straight ribbons, so a
  hub serving such clients builds with `--no-coarse`.
- **The coarse tier never engages for a bacterial genome**: it serves only past
  `coarseBpPerPxThreshold`. `hs1_chrY_self` is `--no-coarse` by design, and a PAF
  with no CIGAR builds `--no-coarse` too (the coarse tier would repeat the fine one).
- **A PIF regen of a version-1 file is never pixel-neutral**: coarse rows shift
  every fine row's byte offset, so `syntenyId`/`uniqueId` change and dense figures
  move in ribbon overlap order.
- **PIF inverts losslessly back to PAF** (`t`-prefixed rows keep the original
  CIGAR); the awk in [pif-coarse-fold-bytes](../measurements/pif-coarse-fold-bytes.json)'s
  repro rebuilds a hosted PIF whose PAF is gone.

## Plugins served off jbrowse.org, not npm

- **blat** is the only **versioned** path
  (`plugins/jbrowse-plugin-blat/dist/v1/…umd.production.min.js`), because the URL
  lands in jb2hubs' generated configs and an unversioned one would push a future
  bundle into every config already out. A change demanding more of the host gets a
  v2. Publish with `plugins/blat/scripts/publish-umd.sh`.

## Private files in S3

Presigned URLs work (`config_guides/authentication.md`). Two silent breakages:
`makeIndex` (`packages/core/src/util/formatGuessers.ts`) appends `.bai` to the whole
URI, after the signature params, so spell out both locations; and `getFileName`
returns `sample.bam?X-Amz-…`, so guessers test `/\.bam$/i` against it and guess
nothing. Pick the type in the form or write the adapter `type`.

## Demo assets drift from their build scripts

`jbrowse.org/demos/<topic>/` files are uploaded by hand, so a tutorial, its build
script and its `website/scripts/specs/*.ts` can describe different data with
nothing failing. Auditing one: `curl -I` every hosted URL the doc and spec name,
then check the data matches the prose.

## Third-party mirrors, and what a bucket listing does not prove

**A key in the listing is not a file.** Some keys have size 0 (the whole
`20201028_3202_phased` release, two `.crai`), and a mapping that only asked whether
the key existed repointed a working track at an empty object. Require a nonzero
`<Size>`; `aws s3 ls --no-sign-request --recursive` gives both in one pass.
