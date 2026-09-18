#!/usr/bin/env bash
set -euo pipefail

[[ "${1:-}" == legacy-website ]] || exit 0
while read -r local_ref local_oid remote_ref remote_oid; do
  # Deleting a remote ref does not upload a monorepo tree.
  [[ -n "${local_oid//0/}" ]] || continue
  if [[ "$remote_ref" == refs/heads/main ]] ||
     git cat-file -e "$local_oid:website" 2>/dev/null; then
    echo "Refusing to push the monorepo or main to legacy-website." >&2
    echo "Use git push-website to publish only website/ to remote v5." >&2
    exit 1
  fi
done
