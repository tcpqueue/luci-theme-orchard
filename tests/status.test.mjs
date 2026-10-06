import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let now = 0;
let counters = { rx: 10000, tx: 5000, name: 'eth1' };
let active = true;
let sampleUptime = 100;
let cpuCounters = { total: 1000, idle: 800 };
const cpuSource = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/orchard-cpu.js'), 'utf8');
const cpu = vm.runInNewContext('(function(){' + cpuSource + '})()', {
 rpc: { declare: () => async () => '' }, baseclass: { extend: value => value }
});
const stat = cpu.parse('cpu 100 20 30 400 50 10 5 5 40 15\ncpu0 50 10 15 200 25 5 2 2 20 7\n');
assert.equal(stat.total, 620, 'guest counters must not be counted twice');
assert.equal(stat.idle, 450, 'iowait is excluded from busy CPU time');
assert.equal(cpu.usage(null, stat), null, 'CPU requires two samples');
assert.equal(cpu.usage({ total: 500, idle: 360 }, stat), 25, 'CPU must use interval counter differences');
assert.equal(cpu.usage(stat, { total: 500, idle: 360 }), null, 'CPU reset requires a new baseline');
assert.equal(cpu.usage(stat, stat), null, 'zero interval cannot invent CPU usage');
assert.equal(cpu.parse('cpu invalid 0 0 0'), null);
assert.equal(cpu.parse('cpu0 1 2 3 4'), null, 'per-core rows are not aggregate CPU time');
// Overview includes are optional, translated and may be preceded by plugin cards.
function checkOverviewLayout(storageLoaded) {
 const names = { System: 'Système', Memory: 'Mémoire', Storage: 'Stockage' };
 function card(title, loaded = true) {
  const classes = new Set(['cbi-section']);
  return { classes, classList: { contains: name => classes.has(name), add: name => classes.add(name) },
   querySelector: selector => selector === ':scope > h3' ? { textContent: title } : loaded ? {} : null };
 }
 const extra = card('Plugin'), system = card(names.System), memory = card(names.Memory), storage = card(names.Storage, storageLoaded);
 const grid = new Set(), container = { children: [extra, system, memory, storage], classList: { add: name => grid.add(name) } };
 let refresh;
 const selectors = [];
 const module = vm.runInNewContext('(function(){' + cpuSource + '})()', {
  rpc: { declare: () => async () => '' }, baseclass: { extend: value => value },
  _: name => names[name], L: { bind: (fn, self) => fn.bind(self) }, poll: { add: () => {} },
  document: { documentElement: { lang: 'fr' }, getElementById: id => id === 'view' ? container : {}, querySelector: selector => { selectors.push(selector); return null; } },
  MutationObserver: class { constructor(fn) { refresh = fn; } observe() {} }
 });
 module.monitor();
 assert.equal(selectors[0], '#view > .o-status-system table', 'CPU belongs to the system card even when a plugin precedes it');
 assert.equal(system.classes.has('o-status-system'), true, 'CPU card is marked even if storage is unavailable');
 assert.equal(grid.has('o-status-grid'), storageLoaded, 'a missing include must keep the normal layout');
 if (storageLoaded) {
  assert.equal(system.classes.has('o-status-system'), true, 'localized system card is identified independently of position');
  assert.equal(memory.classes.has('o-status-memory'), true);
  assert.equal(storage.classes.has('o-status-storage'), true);
  assert.equal(extra.classes.size, 1, 'plugin cards keep their original classes');
  refresh();
  assert.equal(grid.size, 1, 'polling mutations do not duplicate or move native containers');
 }
}
checkOverviewLayout(true);
checkOverviewLayout(false);
const device = { getName: () => counters.name, getRXBytes: () => counters.rx, getTXBytes: () => counters.tx };
const wan = { isUp: () => active, getL3Device: () => device, getName: () => 'wan', getI18n: () => 'DHCP', getIPAddrs: () => ['192.0.2.2'] };
const context = vm.createContext({
 performance: { now: () => now },
 rpc: { declare: ({ method }) => async () => ({
  board: { hostname: '<script>alert(1)</script>' },
  info: { uptime: sampleUptime, memory: { total: 1024 } },
  getDHCPLeases: { dhcp_leases: [{ expires: 5 }, { expires: 0 }, { expires: -1 }, { expires: false }] }
 })[method] },
 network: { getWANNetworks: async () => [wan] },
 L: { bind: (fn, self) => fn.bind(self), url: (...parts) => '/' + parts.join('/') },
 view: { extend: value => value },
 orchardCpu: { read: async () => cpuCounters, usage: cpu.usage }
});
const source = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/view/orchard/overview.js'), 'utf8');
const view = vm.runInContext('(function(){' + source + '})()', context);
let first = await view.sample();
assert.equal(first.traffic.down, null, 'first sample must not invent a rate');
assert.equal(first.cpu, null);
assert.equal(first.leases.length, 2, 'exclude expired leases while retaining unlimited leases');
now = 5000; counters.rx += 1000; counters.tx += 500; sampleUptime += 5;
cpuCounters = { total: 1500, idle: 1200 };
let second = await view.sample();
assert.equal(second.traffic.down, 200);
assert.equal(second.traffic.up, 100);
assert.equal(second.cpu, 20);
assert.equal(second.traffic.history.length, 1);
now = 10000; counters.rx = 1; counters.tx = 1; sampleUptime += 5;
assert.equal((await view.sample()).traffic.down, null, 'counter reset must not produce negative rates');
now = 15000; counters.rx += 1000; counters.tx += 500; counters.name = 'pppoe-wan';
assert.equal((await view.sample()).traffic.down, null, 'changing uplinks requires a new baseline');
now = 20000; active = false;
let absent = await view.sample();
assert.equal(absent.wan.up, false);
assert.equal(absent.traffic.down, null, 'absent WAN must not fabricate throughput');
now = 25000; active = true; sampleUptime = 1;
assert.equal((await view.sample()).traffic.down, null, 'reboot requires a fresh baseline');
// LuCI may invoke a new poller synchronously, before render() has returned its DOM.
let attached = false, removed = false, renders = 0, registeredPoller;
context.E = () => ({ querySelector: () => null });
context.document = { contains: () => attached };
context.window = { OrchardOverview: { render: () => { renders++; } } };
context.network.flushCache = async () => undefined;
context.poll = { add: fn => { registeredPoller = fn; fn(); }, remove: () => { removed = true; } };
view.render(first);
assert.equal(removed, false, 'early poll invocation must not unregister before mount');
attached = true;
await registeredPoller();
assert.equal(renders, 2, 'polling must refresh after the DOM is mounted');
attached = false;
await registeredPoller();
assert.equal(removed, true, 'poller must unregister when a mounted view is removed');
const acl = JSON.parse(fs.readFileSync(path.join(root, 'root/usr/share/rpcd/acl.d/luci-theme-orchard.json')));
assert.equal(acl['luci-theme-orchard'].write, undefined, 'dashboard must remain read-only');
assert.deepEqual(acl['luci-theme-orchard'].read.file, { '/proc/stat': ['read'] }, 'CPU file permission is restricted to kernel counters');
for (const file of ['menu-orchard.js', 'orchard-cpu.js', 'view/orchard/overview.js']) {
 new Function(fs.readFileSync(path.join(root, 'htdocs/luci-static/resources', file), 'utf8'));
}
for (const file of ['orchard.js', 'overview-ui.js']) {
 new vm.Script(fs.readFileSync(path.join(root, 'htdocs/luci-static/orchard', file), 'utf8'));
}
console.log('PASS: CPU counters, rate sampling, mount lifecycle, resets, WAN absence, DHCP expiry, native overview layout, read-only ACL and JS syntax');
