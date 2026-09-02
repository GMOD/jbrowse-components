---
title: Serving data files
description:
  What a web server has to do for JBrowse to read BAM, CRAM and other indexed
  files over HTTP
guide_category: Deployment
---

**TL;DR:** JBrowse reads your data files directly over HTTP with byte-range
requests, so the server has to return the raw bytes of a range rather than a
whole, re-encoded file. The two settings that break that are
`Content-Encoding: gzip` applied to BGZF files and a missing CORS policy on a
separate data host.

## What the server has to support

JBrowse 2 is static JS/CSS/HTML; copy the folder to your web server or Amazon
S3. The server must support byte-range requests (the
[Range HTTP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range))
so JBrowse can read slices of large files. A server that ignores `Range` turns
every read into a full download.

Django's static resources folder serves the app but not the data files; host
those elsewhere. See
[these notes](https://github.com/cmdcolin/django-jbrowse2-nonworking-example).

## Configure gzip for text, never for BGZF

Gzip shrinks the app's JavaScript and `config.json` considerably. Most cloud
hosts (CloudFront, Amplify, Netlify) compress text responses automatically;
Apache and Nginx have to be told.

For Nginx, add to your server block:

```nginx
gzip on;
gzip_types application/json text/plain text/html text/css text/javascript application/javascript;
```

For Apache, enable `mod_deflate`:

```bash
sudo a2enmod deflate
sudo systemctl restart apache2
```

Then add to your Apache config (e.g.
`/etc/apache2/sites-available/000-default.conf`):

```apache
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

This applies to text only. Never gzip BGZF binary files, see the next section.

## Indexed binary files do not work on my server

Almost always: the server is sending `Content-Encoding: gzip` on a
BGZF-compressed file (BAM, VCF.gz, GFF.gz, BED.gz, .fa.gz, etc.).

BGZF looks like gzip to content sniffers (Apache's `mod_mime_magic`, PHP's
`mime_content_type`, some CDN rules), which add the header, and the browser then
decompresses the file before JavaScript sees it. JBrowse does its own BGZF
decompression and seeks by offsets from `.bai`/`.tbi`/`.csi`/`.gzi`, so the
result is truncated data, "invalid BGZF block", or random gaps.

**The fix:** serve these files as opaque binary with no `Content-Encoding`.

- On Apache, disable `mod_mime_magic`, or scope it. To keep it on elsewhere,
  unset the header for genomic extensions:

  ```apache
  <FilesMatch "\.(bam|bai|cram|crai|vcf\.gz|tbi|csi|gff\.gz|bed\.gz|fa\.gz|gzi|fai)$">
    Header unset Content-Encoding
  </FilesMatch>
  ```

- On Nginx, only `gzip` text MIME types. The default `gzip_types` is fine, just
  don't add `application/octet-stream` or `application/gzip`, and don't enable
  `gzip_static` for genomic files.

- On S3 / CloudFront, don't upload with `--content-encoding gzip`. Fix a bad
  upload with `aws s3 cp --content-encoding "" ...`.

- On PHP / app servers, disable auto-content-type middleware on these paths.

To check, open dev tools' Network tab, request the file, and confirm no
`Content-Encoding: gzip` header on the response.

The rule covers BGZF binary files only. Compressing `config.json` is fine.

## CORS errors on remote files

A CORS error means JBrowse is served from a different domain than your data. The
fix must be on the data server, which must at minimum:

- return `Access-Control-Allow-Origin` matching your JBrowse origin (or `*`),
- allow the `Range` request header (`Access-Control-Allow-Headers: Range`), and
- honor byte-range requests: respond `206 Partial Content` with the requested
  bytes (not `200` with the whole file).

Exposing `Content-Range` is optional: JBrowse detects end-of-file from short or
`416` range responses, and exposing it only lets JBrowse report the true file
size in places like the spreadsheet importer.

For local development only, launching Chrome with `--disable-web-security` is a
temporary workaround.

### S3 / MinIO CORS configuration

Apply this CORS policy to the bucket (S3 console → bucket → Permissions →
Cross-origin resource sharing, or the CLI below). Replace the origin with your
JBrowse host, or use `["*"]` for public data:

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

One-liner to apply it with the AWS CLI:

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET --cors-configuration \
  '{"CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["Range"],"ExposeHeaders":["Content-Range","Content-Length","Accept-Ranges"]}]}'
```

To verify, open dev tools' Network tab and confirm the file request returns
`206 Partial Content` with an `Access-Control-Allow-Origin` header.

The community **MinIO** server has no per-bucket CORS (that is MinIO AIStor
only). It uses the `MINIO_API_CORS_ALLOW_ORIGIN` environment variable, a
comma-separated origin list defaulting to `*`. Set it and restart the server:

```bash
export MINIO_API_CORS_ALLOW_ORIGIN="https://your-jbrowse-host.example.com"
```

## See also

- [](/docs/config_guides/deploying)
- [](/docs/config_guides/authentication)
- [](/docs/quickstart_web)
