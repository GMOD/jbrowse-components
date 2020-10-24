#!/bin/bash
SRC := $(shell node read_sidebar.js)
COMMITSHA := $(shell git rev-parse --short HEAD)
TITLE := $(shell sed -e 's/git-commit-sha/git revision $(COMMITSHA)/' title.md > titlemod.md)

all: md pdf

pdf: $(SRC)
	@for f in $(SRC); do cat $${f} | node tex_parser.js; done > pdfcombined.md

realpdf: pdf
	pandoc titlemod.md pdfcombined.md --listings -H listings.tex  --toc -o jbrowse2.pdf

.PHONY: all

