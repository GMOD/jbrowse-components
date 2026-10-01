---
name: hosting
description: What traps govern JBrowse's hosted assets — the jbrowse.org bucket and CloudFront, the content-addressed figure store, hosted genomes and PIF tiers, plugins served off jbrowse.org? Read before uploading or citing a hosted URL.
audience: internal
kind: operations
---

# Hosted assets and how they are published

Failures here are silent: a stale CDN object looks like a bad config, and a
hand-uploaded demo file looks like one its build script produced. Demo configs
deploy via `scripts/deploy-demo.sh`, never a bare `aws s3 cp` (`CLAUDE.md`): the
bucket has no versioning, so an overwrite that drops a track is unrecoverable.

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

The media store (`jb2-media/`, `website/media.lock`, `pnpm media`) holds big
binaries the docs embed. **It exists because the docs deploy would otherwise
delete the videos**: `update-docs.yml` runs `rclone sync … s3:jbrowse.org/jb2`,
which removes whatever the built `dist/` lacks, and `pnpm build` runs
`figures:pull`, which drives the media store too. Browser-test goldens are the
third corpus (`jb2-snapshots`, `snapshots.lock`); all three share
`@jbrowse/browser-test-utils/blobStore`.

## Hosted genomes and the launch surface

- **Hub URLs** (`packages/core/src/util/fetchHub.ts`): UCSC db →
  `jbrowse.org/ucsc/<db>/config.json`; GenArk → `jbrowse.org/hubs/genark/GCA/964/188/535/GCA_964188535.1/config.json`.
  UCSC dbs ship trix `aggregateTextSearchAdapters`; GenArk ones often don't.
- **The hosted UCSC hg19 hub already carries the usual annotation tracks**,
  referenced by `trackId` with no session track. Check
  `jbrowse.org/ucsc/hg19/config.json` before adding one to a spec.
- **UCSC downloads are `hgdownload.soe.ucsc.edu`, never `hgdownload.cse.ucsc.edu`.**
  UCSC's reissued cert dropped the `cse` SAN, so HTTPS fails
  `ERR_CERT_COMMON_NAME_INVALID` and an assembly refuses to load ("Failed to fetch
  … chromAlias.txt").
- **`&loc=` accepts a gene name; a session spec's `init.loc` does not.** The URL
  param routes through text search; `navToLocString` rejects a non-locstring.
- **Cross-group genome search** is `genomes.jbrowse.org/searchIndex.json`, built by
  jb2hubs' `generateSearchIndex.ts`; per-group files cannot be merged client side.
- **On-the-fly mate assemblies** go through `Core-handleUnrecognizedAssembly` and
  `@cmdcolin/jbrowse-plugin-hubs`, which HEAD-probes a guessed URL. Many mates have
  no hosted config, which drove the unbounded HEAD re-probing.

## Hosted PIFs and the coarse tier

`make-pif` emits the coarse tier (uppercase `T`/`Q` seqids) by default. Check
without downloading: `tabix -l <url> | grep -c '^[TQ]'` for the tier,
`tabix -H <url>` for the `#pif` header.

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
- jb2hubs rebuilds its liftOver PIFs whenever its pinned `@jbrowse/cli` changes
  (`lib/chainpif.sh` holds the stamps).

## Plugins served off jbrowse.org, not npm

- **blat** is the only **versioned** path
  (`plugins/jbrowse-plugin-blat/dist/v1/…umd.production.min.js`), because the URL
  lands in jb2hubs' generated configs and an unversioned one would push a future
  bundle into every config already out. A change demanding more of the host gets a
  v2. Publish with `plugins/blat/scripts/publish-umd.sh`.
- **zarr** is republished by `pnpm betabuild`, which re-downloads the entry point
  after invalidating and fails on md5 mismatch (an upload the edge shadows looks
  like a successful publish).
- **graphgenomeview** is rehosted by jbrowse-plugin-list; a release reaches its
  `latest/` url when the entry's `versions` pin is bumped and `pnpm dep` runs there.

The BLAT proxy (`api.jbrowse.org/ucsc/v1/{blat,ispcr}`, stack `jbrowse-blat-proxy`)
lives in **us-east-1**, where the `*.jbrowse.org` ACM cert is: an HTTP API custom
domain is regional, so its cert must match. `GET .../v1/status` reports the day's
spend and `.github/workflows/blat-canary.yml` probes it daily.

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

- **A demo whose only recipe is a shell script on one build box cannot be
  reproduced.** Each ships a `demos/<topic>/README*.txt`, and `deploy-demo.sh`
  refuses to publish a copy that differs from the tracked one.
- **A field the code stopped needing cannot leave `demos/*/config.json` on its
  own**: `check-live-configs --network` compares the repo copy against the hosted
  one (`HOSTED_MIRRORS`), and one `deploy-demo.sh` retires a difference.
- **Reachability checks cannot see version drift.** `demos/hprc/` holds both v2.0
  and v2.1 files, and both answer 200. jb2hubs' `pnpm check-pangenome-assets`
  probes the next minor and major sibling of whatever version a config names.

## Third-party mirrors, and what a bucket listing does not prove

`website/scripts/third-party-hosts.txt` is the ratchet over which servers a figure
sweep pulls from; removing a line is the win. EBI stalls connections for tens of
seconds. The 1000 Genomes ftp tree is mirrored at
`https://1000genomes.s3.amazonaws.com/` (CORS-open, range-capable), but the path
mapping is not a straight prefix swap (`data_collections/` is dropped, and
`ftp.sra.ebi.ac.uk` CRAMs map under `1000G_2504_high_coverage/{data,additional_698_related/data}/`).
NCBI mirrors the same CRAMs and nothing else.

**A key in the listing is not a file.** Some keys have size 0 (the whole
`20201028_3202_phased` release, two `.crai`), and a mapping that only asked whether
the key existed repointed a working track at an empty object. Require a nonzero
`<Size>`; `aws s3 ls --no-sign-request --recursive` gives both in one pass.

**What no mirror carries** stays on EBI's uptime: `1KG_ONT_VIENNA`, the `20220422`
phased panel, the HGSVC3 calls and `20210124.SV_Illumina_Integration`. We host a
byte-for-byte copy of the 3202-sample ensemble SV callset in `demos/1000g/`. The
hosted catalog config `demos/1000g/config.json` has no copy in this repo; its git
history in `cmdcolin/jbrowse1kg` is the only stand-in for the bucket's missing
versioning.
