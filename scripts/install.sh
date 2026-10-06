#!/bin/sh
set -eu
activate=0
case "${1:-}" in
 --activate) activate=1 ;;
 '') ;;
 *) echo 'Usage: sh scripts/install.sh [--activate]'; exit 2 ;;
esac
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target=${DESTDIR:-}
if [ -z "$target" ]; then
 [ "$(id -u)" = 0 ] || { echo 'Run as root on OpenWrt.'; exit 1; }
 command -v uci >/dev/null || { echo 'OpenWrt UCI is required.'; exit 1; }
 [ -d /usr/share/ucode/luci/template ] || { echo 'This theme requires modern LuCI (OpenWrt 24.10+).'; exit 1; }
else
 [ "$activate" = 0 ] || { echo 'Activation is not supported with DESTDIR.'; exit 2; }
 case "$target" in /*) ;; *) echo 'DESTDIR must be an absolute path.'; exit 2 ;; esac
fi
mkdir -p "$target/www/luci-static/orchard" "$target/www/luci-static/resources/view/orchard" "$target/usr/share/ucode/luci/template/themes/orchard" "$target/usr/share/luci/menu.d" "$target/usr/share/rpcd/acl.d"
mkdir -p "$target/usr/libexec/orchard"
mkdir -p "$target/usr/share/doc/luci-theme-orchard"
cp "$source_dir/LICENSE" "$source_dir/NOTICE" "$target/usr/share/doc/luci-theme-orchard/"
cp "$source_dir/root/usr/libexec/orchard/"*.sh "$target/usr/libexec/orchard/"
chmod 755 "$target/usr/libexec/orchard/"*.sh
cp -R "$source_dir/htdocs/luci-static/orchard/." "$target/www/luci-static/orchard/"
cp "$source_dir/htdocs/luci-static/resources/menu-orchard.js" "$target/www/luci-static/resources/"
cp "$source_dir/htdocs/luci-static/resources/orchard-cpu.js" "$target/www/luci-static/resources/"
cp "$source_dir/htdocs/luci-static/resources/view/orchard/overview.js" "$target/www/luci-static/resources/view/orchard/"
cp "$source_dir/ucode/template/themes/orchard/"*.ut "$target/usr/share/ucode/luci/template/themes/orchard/"
theme_version=$(sed -n 's/^PKG_VERSION:=//p' "$source_dir/Makefile" | head -n 1)
theme_release=$(sed -n 's/^PKG_RELEASE:=//p' "$source_dir/Makefile" | head -n 1)
theme_version="$theme_version-r$theme_release"
case "$theme_version" in ''|*[!a-zA-Z0-9._-]*) echo 'Invalid theme version.'; exit 1 ;; esac
for template in "$target/usr/share/ucode/luci/template/themes/orchard/"*.ut; do
 sed -i "s/@ORCHARD_VERSION@/$theme_version/g" "$template"
done
cp "$source_dir/root/usr/share/luci/menu.d/luci-theme-orchard.json" "$target/usr/share/luci/menu.d/"
cp "$source_dir/root/usr/share/rpcd/acl.d/luci-theme-orchard.json" "$target/usr/share/rpcd/acl.d/"
if [ -z "$target" ]; then
 sh "$source_dir/root/etc/uci-defaults/30_luci-theme-orchard"
 [ "$activate" = 0 ] || sh "$source_dir/scripts/activate.sh"
 rm -f /tmp/luci-indexcache.*
 [ ! -d /tmp/luci-modulecache ] || rm -rf /tmp/luci-modulecache
 /etc/init.d/rpcd reload
fi
echo 'Orchard installed.'
