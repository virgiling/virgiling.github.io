SHELL := /bin/sh
.DEFAULT_GOAL := help

.PHONY: help status doctor install install-homepage install-website \
	check check-cv check-homepage check-website test \
	build build-cv build-homepage build-website \
	dev-homepage dev-website ensure-clean \
	publish publish-cv publish-homepage publish-website

help:
	@echo "MySelf monorepo"
	@echo "  make status            Show repository and submodule state"
	@echo "  make doctor            Check Git, Bun, Node.js, and Typst"
	@echo "  make install           Install both web projects"
	@echo "  make check             Validate all three projects"
	@echo "  make build             Build all three projects"
	@echo "  make dev-homepage      Preview the Next.js homepage"
	@echo "  make dev-website       Preview the Quartz website"
	@echo "  make publish-*         Push one committed subtree to its legacy remote"

status:
	@git status --short --branch
	@git submodule status -- website/content

doctor:
	@command -v git >/dev/null && git --version
	@command -v bun >/dev/null && bun --version
	@command -v node >/dev/null && node --version
	@command -v typst >/dev/null && typst --version

install: install-homepage install-website

install-homepage:
	@cd homepage && bun install --frozen-lockfile

install-website:
	@git submodule update --init --recursive -- website/content
	@cd website && bun install --frozen-lockfile
	@cd website && bun run plugins:install

check: check-cv check-homepage check-website

check-cv:
	@cd cv && typst compile template.typ /tmp/myself-cv-check.pdf --font-path ./fonts

check-homepage:
	@cd homepage && bunx tsc --noEmit
	@cd homepage && bunx eslint .

check-website:
	@cd website && bun run check

test:
	@cd website && bun test

build: build-cv build-homepage build-website

build-cv:
	@cd cv && typst compile template.typ cv.pdf --font-path ./fonts

build-homepage:
	@cd homepage && bun run build

build-website:
	@git submodule update --init --recursive -- website/content
	@cd website && bun run build

dev-homepage:
	@cd homepage && bun run dev

dev-website:
	@git submodule update --init --recursive -- website/content
	@cd website && bun run dev

ensure-clean:
	@test -z "$$(git status --porcelain)" || \
		(echo "Refusing to publish: commit or stash all changes first." >&2; exit 1)

publish: publish-cv publish-homepage publish-website

publish-cv: ensure-clean
	@git subtree push --prefix=cv legacy-cv master

publish-homepage: ensure-clean
	@git subtree push --prefix=homepage legacy-homepage ci

publish-website: ensure-clean
	@git subtree push --prefix=website legacy-website v5
