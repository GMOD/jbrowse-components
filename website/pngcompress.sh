#!/bin/bash

SCREENSHOT_DIR=${JBROWSE_SCREENSHOT_DIR:-~/Downloads/}

X=$(ls -Art $SCREENSHOT_DIR | grep png | tail -n 1)
cat "$SCREENSHOT_DIR/$X" | pngquant - >"website/docs/img/$1.png"
