#!/bin/bash

SCREENSHOT_DIR=${JBROWSE_SCREENSHOT_DIR:-~/Downloads/}

X=$(ls -Art $SCREENSHOT_DIR | grep png | tail -n 1)
pngquant - >"website/docs/img/$1.png" <"$SCREENSHOT_DIR/$X"
