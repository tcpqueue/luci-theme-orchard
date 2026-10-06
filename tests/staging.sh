#!/bin/sh
set -eu
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
for script in "$source_dir"/scripts/*.sh "$source_dir"/root/etc/uci-defaults/*; do sh -n "$script"; done
DESTDIR="$scratch" sh "$source_dir/scripts/install.sh"
test -f "$scratch/www/luci-static/orchard/cascade.css"
test -f "$scratch/www/luci-static/resources/menu-orchard.js"
test -f "$scratch/www/luci-static/resources/orchard-cpu.js"
test -f "$scratch/www/luci-static/resources/view/orchard/overview.js"
test -f "$scratch/usr/share/ucode/luci/template/themes/orchard/header.ut"
test -f "$scratch/usr/share/luci/menu.d/luci-theme-orchard.json"
test -f "$scratch/usr/share/rpcd/acl.d/luci-theme-orchard.json"
test -x "$scratch/usr/libexec/orchard/restore.sh"
test -f "$scratch/usr/share/doc/luci-theme-orchard/LICENSE"
grep -q '?v=' "$scratch/usr/share/ucode/luci/template/themes/orchard/header.ut"
for name in activate restore remove; do cmp "$source_dir/scripts/$name.sh" "$source_dir/root/usr/libexec/orchard/$name.sh"; done
if DESTDIR="$scratch" sh "$source_dir/scripts/install.sh" --activate 2>/dev/null; then echo 'Activation unexpectedly allowed in staging'; exit 1; fi
echo 'PASS: shell syntax, installation paths and staging activation guard'
