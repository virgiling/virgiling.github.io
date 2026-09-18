#!/usr/bin/env bash
set -euo pipefail

dry_run=false
case "${1:-}" in
  "") ;;
  --dry-run) dry_run=true ;;
  -h|--help)
    echo "Usage: $0 [--dry-run]"
    echo "Publish the committed website/ subtree to legacy-website:v5."
    exit 0
    ;;
  *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac
if (( $# > 1 )); then
  echo "Usage: $0 [--dry-run]" >&2
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
cd -- "$repo_root"

if ! git cat-file -e HEAD:website; then
  echo "Run this publisher from the MySelf monorepo containing website/." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=all --ignore-submodules=none -- website)" ]]; then
  echo "Commit or stash changes inside website/ before publishing; other projects may remain dirty." >&2
  exit 1
fi

git remote get-url legacy-website >/dev/null
publish_commit=$(git subtree split --quiet --prefix=website HEAD)
echo "Publishing website/ ($publish_commit) to legacy-website:refs/heads/v5"
if [[ "$dry_run" == true ]]; then
  git push --dry-run legacy-website "$publish_commit:refs/heads/v5"
else
  git push legacy-website "$publish_commit:refs/heads/v5"
fi
