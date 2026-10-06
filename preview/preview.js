/* SPDX-License-Identifier: Apache-2.0 */
(function () {
 'use strict';
 var main = document.getElementById('maincontent');
 var groups = [
  { key: 'status', label: '状态', children: [['overview', '总览'], ['clients', 'DHCP 客户端']] },
  { key: 'network', label: '网络', children: [['network', '网络接口'], ['wireless', '无线网络']] },
  { key: 'system', label: '系统', children: [['system', '系统设置']] }
 ];
 var sample = {
  demo: true,
  cpu: 8.4,
  board: { hostname: 'Orchard', model: 'Orchard Router', kernel: '6.6.73', release: { description: 'OpenWrt 24.10 · 演示设备', target: 'mediatek/filogic' } },
  info: { uptime: 1054860, load: [9830, 6553, 7864], memory: { total: 1073741824, available: 730144440 } },
  wan: { up: true, protocol: 'DHCP', ip: '192.0.2.18' },
  traffic: { down: 3120000, up: 430000, history: [8,10,9,16,18,14,12,11,14,21,26,22,19,25,29,26,20,16,18,20,28,33,29,24,30,35,29,26,27,34,30,24,26,28,23,25].map(function (n, i) { return { down: n * 125000, up: [2,3,2,4,3,2,3,4,3][i % 9] * 125000 }; }) },
  leases: [
   { hostname: 'MacBook Pro', ipaddr: '192.168.1.108', macaddr: '02:16:3E:20:00:01', expires: 35820 },
   { hostname: 'iPhone', ipaddr: '192.168.1.112', macaddr: '02:16:3E:20:00:02', expires: 27300 },
   { hostname: 'Living Room', ipaddr: '192.168.1.120', macaddr: '02:16:3E:20:00:03', expires: 41400 }
  ],
  links: { interfaces: '#network', wireless: '#wireless', system: '#system', leases: '#clients' }
 };
 var defaults = { hostname: 'Orchard', timezone: 'Asia/Shanghai', ssid: 'Orchard Home', channel: '自动', encryption: 'WPA2/WPA3 混合', wifi: true, guest: false, lan: '192.168.1.1', netmask: '255.255.255.0' };
 var saved = Object.assign({}, defaults);
 try { Object.assign(saved, JSON.parse(localStorage.getItem('orchard.demo.settings') || '{}')); } catch (_) {}
 function escape(value) { return String(value).replace(/[&<>"']/g, function (char) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]; }); }
 function toast(message) { var node = document.querySelector('.preview-toast'); node.textContent = message; node.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(function () { node.hidden = true; }, 4000); }
 function input(key, type) { return '<input class="cbi-input-text" id="field-' + key + '" name="' + key + '" type="' + (type || 'text') + '" value="' + escape(saved[key]) + '" required>'; }
 function select(key, values) { return '<select id="field-' + key + '" name="' + key + '">' + values.map(function (value) { return '<option' + (value === saved[key] ? ' selected' : '') + '>' + escape(value) + '</option>'; }).join('') + '</select>'; }
 function field(key, label, control, description) { return '<div class="cbi-value"><label class="cbi-value-title" for="field-' + key + '">' + label + '</label><div class="cbi-value-field">' + control + (description ? '<div class="cbi-value-description">' + description + '</div>' : '') + '</div></div>'; }
 function toggle(key, label) { return '<label class="preview-switch" aria-label="' + label + '"><input type="checkbox" role="switch" id="field-' + key + '" name="' + key + '"' + (saved[key] ? ' checked' : '') + '><span></span></label>'; }
 function actions() { return '<div class="cbi-page-actions"><button type="button" class="cbi-button" data-reset>重置</button><button type="submit" class="cbi-button cbi-button-apply">保存并应用</button></div>'; }
 function menu(route) {
  var nav = document.getElementById('orchard-menu');
  var prior = Array.from(nav.querySelectorAll('details')).filter(function (node) { return node.open; }).map(function (node) { return node.dataset.group; });
  nav.replaceChildren();
  groups.forEach(function (group) {
   var details = document.createElement('details'); details.className = 'orchard-menu-group'; details.dataset.group = group.key;
   details.open = prior.includes(group.key) || group.children.some(function (item) { return item[0] === route; });
   var summary = document.createElement('summary'); var graphic = window.Orchard.icon(group.key); graphic.classList.add('orchard-menu-icon', 'orchard-menu-icon-' + group.key);
   var title = document.createElement('span'); title.textContent = group.label; summary.append(graphic, title, window.Orchard.icon('arrow')); details.append(summary);
   var list = document.createElement('ul');
   group.children.forEach(function (item) { var li = document.createElement('li'); var a = document.createElement('a'); a.href = '#' + item[0]; a.className = 'orchard-menu-link' + (item[0] === route ? ' active' : ''); a.textContent = item[1]; if (item[0] === route) { a.setAttribute('aria-current', 'page'); document.getElementById('orchard-location-title').textContent = item[1]; } li.append(a); list.append(li); });
   details.append(list); nav.append(details);
  });
 }
 function bindForm() {
  var form = main.querySelector('form'); if (!form) return;
  form.addEventListener('submit', function (event) {
   event.preventDefault();
   new FormData(form).forEach(function (value, key) { if (key in defaults) saved[key] = value; });
   form.querySelectorAll('input[type="checkbox"]').forEach(function (control) { saved[control.name] = control.checked; });
   try { localStorage.setItem('orchard.demo.settings', JSON.stringify(saved)); } catch (_) {}
   toast('已保存到本地预览；未修改路由器配置');
  });
  form.querySelector('[data-reset]')?.addEventListener('click', function () { render(); toast('已恢复上次保存的预览设置'); });
 }
 function render() {
  var route = location.hash.slice(1) || 'overview';
  if (!groups.some(function (g) { return g.children.some(function (i) { return i[0] === route; }); })) route = 'overview';
  menu(route); window.Orchard.closeNavigation();
  if (route === 'overview' || route === 'clients') {
   var holder = document.createElement('div'); holder.id = 'orchard-overview'; main.replaceChildren(holder);
   window.OrchardOverview.render(holder, sample);
   if (route === 'clients') { holder.querySelector('.o-page-heading h2').textContent = 'DHCP 客户端'; Array.from(holder.children).forEach(function (child) { if (!child.classList.contains('o-page-heading') && !child.classList.contains('o-clients-card')) child.remove(); }); }
   return;
  }
  if (route === 'network') {
   main.innerHTML = '<h2>网络接口</h2><p class="preview-intro">管理路由器与外部网络之间的连接。</p><div class="preview-interface-grid"><section class="o-card preview-interface"><div class="preview-interface-title"><span class="preview-icon-square o-blue" data-icon="network"></span><h3>WAN</h3><span class="o-pill o-pill-green"><i class="o-dot"></i>已连接</span></div><div class="o-info-row"><span>协议</span><span>DHCP 客户端</span></div><div class="o-info-row"><span>IPv4 地址</span><span>192.0.2.18</span></div><div class="o-info-row"><span>网关</span><span>192.0.2.1</span></div><button type="button" class="btn" data-wan>查看连接</button></section><section class="o-card preview-interface"><div class="preview-interface-title"><span class="preview-icon-square o-green" data-icon="router"></span><h3>LAN</h3><span class="o-pill o-pill-green"><i class="o-dot"></i>已连接</span></div><div class="o-info-row"><span>协议</span><span>静态地址</span></div><div class="o-info-row"><span>IPv4 地址</span><span>' + escape(saved.lan) + '</span></div><div class="o-info-row"><span>设备</span><span>br-lan</span></div><a class="btn" href="#lan-form">编辑配置</a></section></div><form id="lan-form"><section class="cbi-section"><h3>LAN 配置</h3>' + field('lan', 'IPv4 地址', input('lan'), '修改地址后，需要使用新地址访问管理页面。') + field('netmask', 'IPv4 子网掩码', input('netmask')) + '</section>' + actions() + '</form>';
   main.querySelector('[data-wan]').addEventListener('click', function () { toast('演示连接：DHCP · 192.0.2.18 · eth1'); });
   main.querySelector('a[href="#lan-form"]').addEventListener('click', function (event) { event.preventDefault(); main.querySelector('#field-lan').focus(); });
  } else if (route === 'wireless') {
   main.innerHTML = '<h2>无线网络</h2><p class="preview-intro">一个熟悉的网络，连接你的日常。</p><form><section class="cbi-section"><div class="preview-wireless-heading"><div><h3>主无线网络</h3><p>5 GHz · 802.11ax · radio1</p></div>' + toggle('wifi', '启用主无线网络') + '</div>' + field('ssid', '网络名称（SSID）', input('ssid')) + field('channel', '信道', select('channel', ['自动', '36', '40', '44', '48', '149'])) + field('encryption', '加密方式', select('encryption', ['WPA2/WPA3 混合', 'WPA3-SAE', 'WPA2-PSK'])) + '</section><section class="cbi-section"><h3>访客网络</h3>' + field('guest', '启用访客网络', toggle('guest', '启用访客网络'), '预览开关仅演示控件外观，不会创建无线网络。') + '</section>' + actions() + '</form>';
  } else {
   main.innerHTML = '<h2>系统设置</h2><p class="preview-intro">让这台路由器，按你的习惯工作。</p><form><ul class="cbi-tabmenu"><li class="cbi-tab"><a href="#system" data-tab="general">常规设置</a></li><li class="cbi-tab-disabled"><a href="#system" data-tab="appearance">外观</a></li></ul><div data-pane="general"><section class="cbi-section"><h3>基本设置</h3>' + field('hostname', '主机名', input('hostname'), '在网络中标识这台路由器。') + field('timezone', '时区', select('timezone', ['Asia/Shanghai', 'UTC', 'Asia/Tokyo', 'America/Los_Angeles'])) + '</section><section class="cbi-section"><h3>系统信息</h3><div class="o-info-row"><span>固件版本</span><span>OpenWrt 24.10 · 演示设备</span></div><div class="o-info-row"><span>主题版本</span><span>Orchard 0.2.0</span></div></section></div><div data-pane="appearance" hidden><section class="cbi-section"><h3>外观</h3><p>用左下角的外观控件切换浅色、深色或跟随系统。设置即时生效，并仅保存在当前浏览器。</p></section></div>' + actions() + '</form>';
   main.querySelectorAll('[data-tab]').forEach(function (tab) { tab.addEventListener('click', function (event) { event.preventDefault(); main.querySelectorAll('[data-tab]').forEach(function (item) { item.parentElement.className = item === tab ? 'cbi-tab' : 'cbi-tab-disabled'; }); main.querySelectorAll('[data-pane]').forEach(function (pane) { pane.hidden = pane.dataset.pane !== tab.dataset.tab; }); }); });
  }
  main.querySelectorAll('[data-icon]').forEach(function (node) { node.replaceChildren(window.Orchard.icon(node.dataset.icon)); });
  bindForm();
 }
 window.addEventListener('hashchange', render);
 render();
})();
