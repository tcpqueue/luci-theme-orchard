import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function element(tag, attrs, children) {
 const result = { tag, attrs: attrs || {}, children: [], style: {}, appendChild(child) { this.children.push(child); } };
 if (children != null) result.children.push(...(Array.isArray(children) ? children : [children]));
 return result;
}
const tabs = element('div');
const dispatchpath = ['admin', 'services', 'plugin', 'a', 'b', 'c', 'd'];
const source = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/menu-orchard.js'), 'utf8');
const menu = vm.runInNewContext('(function(){' + source + '})()', {
 baseclass: { extend: value => value },
 ui: { menu: { getChildren: node => Object.values(node.children || {}) } },
 L: { env: { dispatchpath }, url: (...parts) => '/' + parts.join('/') },
 E: element, _: value => value,
 document: { getElementById: () => tabs }
});
let child = { name: 'd', title: 'D', children: {} };
for (const name of ['c', 'b', 'a']) child = { name, title: name.toUpperCase(), children: { [child.name]: child } };
menu.renderTabs({ children: { a: child } }, ['admin', 'services', 'plugin'], 3);
assert.equal(tabs.children.length, 4, 'deep plugin tabs must retain every level');
assert.deepEqual(tabs.children.map(list => list.children[0].attrs.class), ['tabmenu-item-a active', 'tabmenu-item-b active', 'tabmenu-item-c active', 'tabmenu-item-d active'], 'retain standard LuCI classes used by plugins');
assert.equal(tabs.children[3].children[0].children[0].attrs.href, '/admin/services/plugin/a/b/c/d');
assert.equal(tabs.children[0].children[0].children[0].attrs['aria-current'], 'page');
console.log('PASS: deep plugin tab order, standard classes, URLs and active state');
