#!/usr/bin/env bash
#
# Restores the USER-LEVEL agent skills that are deliberately not in this repo.
#
# The workspace skills (.kiro/skills and .claude/skills) are committed and arrive
# with a clone. The three.js graphics pack is not: it is 68M of binary example
# assets, which does not belong in git history. This script fetches it.
#
# Safe to re-run. Existing skill folders are left alone.
#
# Usage:  bash scripts/restore-skills.sh
#
set -euo pipefail

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

GFX_REPO="https://github.com/scottstts/threejs-awesome-graphics-agent-skills.git"

echo "Restoring user-level agent skills"
echo

for dest in "$HOME/.kiro/skills" "$HOME/.claude/skills"; do
  mkdir -p "$dest"
done

echo "  cloning graphics pack (~68M, shallow)…"
git clone --depth 1 --quiet "$GFX_REPO" "$STAGE/gfx"

added_total=0
for dest in "$HOME/.kiro/skills" "$HOME/.claude/skills"; do
  added=0
  skipped=0
  for src in "$STAGE"/gfx/skills/*/; do
    name="$(basename "$src")"
    if [ -d "$dest/$name" ]; then
      skipped=$((skipped + 1))
      continue
    fi
    cp -r "$src" "$dest/$name"
    added=$((added + 1))
  done
  echo "  $dest  added=$added skipped=$skipped"
  added_total=$((added_total + added))
done

echo
echo "Verifying"
python3 - <<'PY'
import os, re

expected = 24
for root in (os.path.expanduser("~/.kiro/skills"), os.path.expanduser("~/.claude/skills")):
    found, bad = 0, []
    for d in sorted(os.listdir(root)):
        if not d.startswith("threejs-"):
            continue
        p = os.path.join(root, d, "SKILL.md")
        if not os.path.isfile(p):
            bad.append((d, "no SKILL.md"))
            continue
        text = open(p, encoding="utf-8").read()
        if not text.startswith("---"):
            bad.append((d, "no frontmatter"))
            continue
        fm = text.split("---", 2)[1]
        name = re.search(r"^name:\s*(.+)$", fm, re.M)
        if not name or name.group(1).strip() != d:
            bad.append((d, "name mismatch"))
            continue
        found += 1
    label = root.replace(os.path.expanduser("~"), "~")
    status = "ok" if found >= expected and not bad else "CHECK"
    print(f"  {label:<26} graphics skills={found:<3} {status} {bad if bad else ''}")

# The router cross-references its siblings; a partial install breaks routing.
router = os.path.expanduser("~/.kiro/skills/threejs-skill-router/SKILL.md")
if os.path.isfile(router):
    refs = set(re.findall(r"\$(threejs-[a-z-]+)", open(router, encoding="utf-8").read()))
    missing = [r for r in sorted(refs) if not os.path.isdir(os.path.expanduser(f"~/.kiro/skills/{r}"))]
    print(f"  router references={len(refs)} missing={missing or 'none'}")
PY

echo
echo "Done. Skills are discovered when a new agent session starts."
