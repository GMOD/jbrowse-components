---
title: Serving data files
description:
  What a web server has to do for JBrowse to read BAM, CRAM and other indexed
  files over HTTP
guide_category: Deployment
---

**TL;DR:** JBrowse reads your data files directly over HTTP with byte-range
requests, so the server has to return the raw bytes of a range, never a whole
re-encoded file. The two settings that break that are `Content-Encoding: gzip`
applied to BGZF files and a missing CORS policy on a separate data host.

## What the server has to support

JBrowse 2 is static JS/CSS/HTML with no backend, deployed by copying the folder
to a web server or S3. The server must honor the
[Range HTTP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range)
so JBrowse can read small slices of large binary files; a server that ignores
`Range` turns every read into a full download. Django's static resources folder
serves the app but not the data files, which need a separate server
([notes](https://github.com/cmdcolin/django-jbrowse2-nonworking-example)).

## Configure gzip for text, never for BGZF

gzip cuts the app's JavaScript to about a third and shrinks a large
`config.json` the same way. Cloud hosts (CloudFront, Amplify, Netlify) compress
text automatically; Apache and Nginx have to be told, and only for text types.

Nginx:

```nginx
gzip on;
gzip_types application/json text/plain text/html text/css text/javascript application/javascript;
```

Apache, after `sudo a2enmod deflate`:

```apache
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

## Indexed binary files do not work on my server

Almost always the server is sending `Content-Encoding: gzip` on a BGZF file
(BAM, VCF.gz, GFF.gz, BED.gz, .fa.gz). BGZF looks like gzip, so content sniffers
(Apache's `mod_mime_magic`, PHP's `mime_content_type`, some CDN auto-rules) add
the header and the browser decompresses the file before JavaScript sees it.
JBrowse does its own BGZF decompression and seeks by offsets from
`.bai`/`.tbi`/`.csi`/`.gzi`, so what it gets is truncated data, "invalid BGZF
block", or random gaps. Serve these files as opaque binary with no
`Content-Encoding`:

- **Apache:** disable `mod_mime_magic`, or unset the header for genomic
  extensions:

  ```apache
  <FilesMatch "\.(bam|bai|cram|crai|vcf\.gz|tbi|csi|gff\.gz|bed\.gz|fa\.gz|gzi|fai)$">
    Header unset Content-Encoding
  </FilesMatch>
  ```

- **Nginx:** keep `gzip_types` to text types; never add
  `application/octet-stream` or `application/gzip`, and never enable
  `gzip_static` for genomic files.
- **S3 / CloudFront:** don't upload with `--content-encoding gzip`. Fix a bad
  upload with `aws s3 cp --content-encoding "" ...`.
- **PHP / app servers:** disable auto-content-type middleware on these paths.

To check, request the file in dev tools' Network tab and confirm the response
carries no `Content-Encoding: gzip`.

## CORS errors on remote files

A CORS error means JBrowse is served from a different origin than the data (a
separate S3 or MinIO bucket, say). JBrowse cannot work around it; the data
server must:

- return `Access-Control-Allow-Origin` matching your JBrowse origin (or `*`)
- allow the `Range` request header (`Access-Control-Allow-Headers: Range`)
- answer range requests with `206 Partial Content` and the requested bytes, not
  `200` with the whole file

Exposing `Content-Range` is optional: JBrowse detects end-of-file from short or
`416` responses, and `Content-Length` is CORS-safelisted, so download progress
works either way. Exposing it lets JBrowse report the true file size in places
like the spreadsheet importer. For local development only, Chrome's
`--disable-web-security` flag is a temporary workaround.

### S3 / MinIO CORS configuration

Apply this policy to the bucket (S3 console → bucket → Permissions →
Cross-origin resource sharing, or `aws s3api put-bucket-cors`), with your
JBrowse host as the origin or `["*"]` for public data:

```json
[
  {
    "AllowedOrigins": ["https://your-jbrowse-host.example.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges"]
  }
]
```

A working file request then shows `206 Partial Content` with an
`Access-Control-Allow-Origin` header in dev tools' Network tab.

Community **MinIO** has no per-bucket CORS (that is MinIO AIStor); it takes a
global origin list in `MINIO_API_CORS_ALLOW_ORIGIN`, which defaults to `*`:

```bash
export MINIO_API_CORS_ALLOW_ORIGIN="https://your-jbrowse-host.example.com"
```

## See also

- [](/docs/config_guides/deploying)
- [](/docs/config_guides/authentication)
- [](/docs/quickstart_web)
