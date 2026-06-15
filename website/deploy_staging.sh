#!/bin/bash

SITE_BASE_PATH=/jb2-staging pnpm build
aws s3 sync dist s3://jbrowse.org/jb2-staging/
aws cloudfront create-invalidation --distribution-id E13LGELJOT4GQO --paths "/jb2-staging/*"
