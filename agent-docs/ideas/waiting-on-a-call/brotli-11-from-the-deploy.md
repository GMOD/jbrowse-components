---
name: brotli-11-from-the-deploy
description: Pre-compressing jbrowse-web at Brotli quality 11 in the S3 deploy saves 65 KB gz (empty page) to 97 KB (four tracks) over the roughly quality-5 Brotli CloudFront applies. It needs a CloudFront Function and a distribution update, which are production config and want a call first; the CloudFront side is untested.
---

# Brotli-11 from the deploy

The jbrowse.org distribution (`E13LGELJOT4GQO`) already serves Brotli through its
cache policy at roughly quality 5. The gain is quality 5 to 11 (`main.js` 121.0
KB to 108.5 KB), not Brotli over gzip. Measured 2026-10-08 on a stale build.

## What it takes

- A compress step in the S3 deploys of `push.yml` and `release.yml`.
- `.br` objects uploaded with `Content-Encoding: br`, the content type and the
  immutable cache header. `aws s3 sync` sets no per-file encoding.
- A CloudFront Function that rewrites to the `.br` key when `Accept-Encoding`
  includes `br`.

## The call

The Function and the distribution update are production config. Test on the
per-branch S3 path with `curl` under `br`, `gzip` and no header, then Firefox.
