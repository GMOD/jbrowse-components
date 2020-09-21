#!/bin/bash
SRC := $(shell node read_sidebar.js)
COMMITSHA := $(shell git rev-parse --short HEAD)
TITLE := $(shell sed -e 's/git-commit-sha/git revision $(COMMITSHA)/' title.md > titlemod.md)

all: md pdf

pdf: $(SRC)
	 @for f in $(SRC); do cat $${f} | node tex_parser.js; done | pandoc titlemod.md - --listings -H listings.tex  --toc -o jbrowse2.pdf

md: $(SRC)
	@(echo '---\ntitle: JBrowse 2 combined guide\nid: combined\n---\n\nThis document is a collection of all our documentation. It includes our quick start guide, user guide, configuration guide, CLI guide, developer guide, and FAQ. You can browse the other documents individually, but this page is to help simple ctrl+f searching and easy browsing. You can also download a pdf version of these same docs located at https://jbrowse.org/jb2/jbrowse2.pdf\n\n' && for f in $(SRC); do cat $${f} | node md_parser.js; done) > combined.md

.PHONY: all

