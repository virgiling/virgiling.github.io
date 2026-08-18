# Repository Guidelines

## Scope

This is one personal-site monorepo with three independently buildable projects:

- `cv/`: Typst CV and cover-letter sources.
- `homepage/`: Next.js personal and research homepage.
- `website/`: Quartz knowledge garden; `website/content/` remains a Git submodule.

## Git and Orca model

- Treat the repository root as the only Git and Orca project root.
- Work directly on `main` for normal maintenance.
- Do not create a branch or worktree unless the user explicitly asks for one.
- Never initialize nested Git repositories inside `cv/`, `homepage/`, or `website/`.
- Commit cross-project changes together when they express one coherent personal-profile update.
- The `legacy-*` remotes are deployment mirrors. Do not push to them unless the user explicitly asks to publish.

## Commands

Run commands from the repository root:

- `make status`: show the root repository and content-submodule state.
- `make doctor`: check required local tools.
- `make install`: install JavaScript dependencies for both sites.
- `make check`: validate all three projects.
- `make build`: build both sites and the CV.
- `make dev-homepage` / `make dev-website`: start one local preview.

Use Bun for both JavaScript projects. Do not introduce another root package manager or a shared dependency lockfile.

## Change discipline

- Keep project-specific configuration inside its project directory.
- Preserve the separate build and deployment behavior documented in each project.
- Run the narrow project check while iterating, then `make check` before completing a cross-project change.
- Do not edit generated output (`homepage/.next`, `homepage/out`, `website/public`) by hand.
- Initialize `website/content` with `git submodule update --init --recursive` when a fresh checkout needs blog content.
