#!/bin/bash

SITE_BASE_PATH=/jb2-staging pnpm build
rclone --config rclone.conf sync disthash: s3:jbrowse.org/jb2-staging --checksum --fast-list
aws cloudfront create-invalidation --distribution-id E13LGELJOT4GQO --paths "/jb2-staging/*"
