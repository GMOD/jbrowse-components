---
name: hosting
description: What traps govern JBrowse's hosted assets — the jbrowse.org bucket and CloudFront, the content-addressed figure store, hosted genomes and PIF tiers, plugins served off jbrowse.org? Read before uploading or citing a hosted URL.
audience: internal
kind: operations
---

# Hosted assets and how they are published

## Bucket and CDN

Origin `s3://jbrowse.org`, fronted by CloudFront `E13LGELJOT4GQO`.

- **The distribution keys through the cache policy
  `jbrowse-org-cors-all-querystrings`** (`42ae4ec5-e759-43d8-be2a-b014f56a82cd`):
  all query strings, the `Origin` and `Access-Control-Request-*` headers, no
  cookies, TTL 0/86400/31536000, plus Brotli, which CloudFront serves only
  through a cache policy. `HttpVersion` is `http2and3`. To roll back,
  `update-distribution` with `DefaultCacheBehavior.ForwardedValues` holding that
  key and those TTLs, no `CachePolicyId`, and `HttpVersion` `http2`.
- **Run CloudFront commands as `uvx --from awscli aws cloudfront …`**: an old
  aws CLI lacks `create-cache-policy`, and its `get-distribution-config` can
  drop newer fields.
- genomes.jbrowse.org (`E12EBG02P68TDO`, nginx on EC2, TTLs 0) serves only the
  catalog site and keeps the legacy settings.
- **An rclone upload of a key the bucket has never held** needs `rclone copyto
  --s3-no-check-bucket`.
- **CloudFront allows 15 wildcard invalidations in progress**, so a bulk upload
  invalidates exact paths.

**An upload is not a publish.** After `aws s3 cp` the plain URL keeps serving the
cached object, and the app and screenshot generator use the plain URL, so the old
config loads silently ("Could not resolve identifier `<new_trackId>`" over an empty
band). `scripts/deploy-demo.sh <local-file> <demos-relative-path>` copies,
invalidates and sets the JSON content-type. Wait for the plain URL to reflect the
change before regenerating anything that reads it.

- **genomes.jbrowse.org and staging share one origin, a t2.nano EC2 nginx box
  behind CloudFront.** Home page answering while `/ucsc/<db>/`, `/accession/…`
  and `/robots.txt` 504 after 30 s means the origin hung; jb2hubs'
  `DEVELOPERS.md` "Origin server" has how to reach, diagnose and reboot it
  (check `/proc/cmdline` still carries `kho=off` first).

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
- **A rebuilt UCSC aggregate index (`jbrowse.org/ucsc/<asm>/trix/`) ships only
  once FANCS and BRCA search clean.** The CLI indexes each GFF3 value on the
  feature that owns it (hg38 FANCS 369 records to 2); a build from a CLI older
  than 5.0.0-beta.20 brings the transcript-repeated synonyms back.
  `products/jbrowse-web/browser-tests/suites/text-search-hg38.ts` asserts both.
- **Each RefSeqFE element on the hosted NCBI RefSeq GFF (`hg38-ncbiRefSeqGff`)
  is three top-level rows sharing a `Dbxref=GeneID`:** a `biological_region`
  whose `standard_name` is the label, one or more class rows (`enhancer`,
  `silencer`, …) and a `match` (`Target=NG_…`) padded 100 bp each side. None
  has a Parent, so all three draw as plain boxes. Grouping them is a jb2hubs
  data-shape question (`hubtools/src/ncbiGff.ts`), not a gene-glyph one.

- **genomes.jbrowse.org runs main.** Portal pages `/ucsc/<db>/` and
  `/accession/<GCF>/` link `https://jbrowse.org/code/jb2/main/?config=<hub
  config>`, which push.yml's "Build and deploy jbrowse-web to S3" job rewrites
  ~20 min after each push to main (a pending run is cancelled by a newer push,
  so watch the newest main run). A rendering fix reaches the portal on push;
  capture the hub with `products/jbrowse-capture/esm/bin.js --instance
  https://jbrowse.org/code/jb2/main/ --hub <db|accession>`, once before the
  deploy for a free "before". A hub's GFF3 track is position-sorted and
  tabix-windowed (the GenArk SARS-CoV-2 GFF is in
  `plugins/gff3/src/test_data/`).
- **Two of the three ways to point at a JBrowse are the release.** `jbrowse
  create <dir>` installs the newest release of the CLI's major, and
  `https://jbrowse.org/code/jb2/latest/` is also the release (`release.yml`);
  `https://jbrowse.org/code/jb2/main/` is main (`push.yml`, as
  `code/jb2/<ref>`), and `jbrowse create --branch <name>` (`--nightly` is main)
  fetches `code/jb2/<name>/jbrowse-web-<name>.zip`. A portal or capture showing
  an unshipped feature on `latest` renders it missing, which reads as broken.
  For unpushed work, bundle a local `products/jbrowse-web/build`.

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

- **blat**'s `plugins/jbrowse-plugin-blat/dist/v1/…umd.production.min.js` is
  frozen: hub configs named it until the plugin store hosted the plugin, and
  configs published then still do. Nothing republishes it; the plugin
  (GMOD/jbrowse-plugin-blat) releases through the store's `latest/` path like
  the other hub plugins.

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

- **UCSC GenArk renames hub files in place under the same accession** (the NHGRI
  apes' `*-v2.0_pri.*` became `*-v2.1_pri.*` by 2026-09-27), so a config that
  copied hub URIs 404s silently; in MultiWaySyntenyDisplay a lane whose gene
  track 404s draws tan boxes and reads as a rendering change. `curl -I` the URIs
  and list the hub directory for a renamed sibling.
