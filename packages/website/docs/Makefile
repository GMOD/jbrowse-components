#!/bin/bash
SRC := $(shell node read_sidebar.js)
COMMITSHA := $(shell git rev-parse --short HEAD)
TITLE := $(shell sed -e 's/git-commit-sha/git revision $(COMMITSHA)/' title.md > titlemod.md)

all: md pdf

pdf: $(SRC)
	 @for f in $(SRC); do cat $${f} | node tex_parser.js; done | pandoc titlemod.md - --toc -o jbrowse2.pdf

md: $(SRC)
	@(echo '---\ntitle: JBrowse 2 single page guide\nid: single_page\n---' && for f in $(SRC); do cat $${f} | node md_parser.js; done) > single_page.md

.PHONY: all

