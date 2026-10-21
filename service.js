/* Amr TV Home - background service (runs inside TizenBrew's Node service).
   Gives the home screen access to the TV: list apps, launch apps, read app icons.
   Written in ES5 for old Node versions on Tizen. */
'use strict';
var http = require('http');
var fs = require('fs');
var urlLib = require('url');
var PORT = 8085;

function send(res, code, type, body) {
  res.writeHead(code, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
function json(res, obj) { send(res, 200, 'application/json', JSON.stringify(obj)); }

function listApps(cb) {
  try {
    tizen.application.getAppsInfo(function (list) {
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        out.push({ id: a.id, name: a.name, icon: a.iconPath || '', show: a.show, pkg: a.packageId });
      }
      cb(null, out);
    }, function (e) { cb((e && e.name) + ': ' + (e && e.message)); });
  } catch (e) { cb('ex ' + (e && e.message)); }
}

var server = http.createServer(function (req, res) {
  var u = urlLib.parse(req.url, true);
  if (u.pathname === '/ping') return json(res, { ok: true, v: 2 });
  if (u.pathname === '/apps') {
    return listApps(function (err, apps) { json(res, err ? { ok: false, error: String(err) } : { ok: true, apps: apps }); });
  }
  if (u.pathname === '/launch') {
    var id = u.query.id;
    try {
      tizen.application.launch(id, function () { json(res, { ok: true }); },
        function (e) { json(res, { ok: false, error: (e && e.name) + ': ' + (e && e.message) }); });
    } catch (e) { json(res, { ok: false, error: 'ex ' + (e && e.message) }); }
    return;
  }
  if (u.pathname === '/icon') {
    var p = String(u.query.path || '').replace(/^file:\/\//, '');
    if (!/^\/(opt|usr)\//.test(p) || /\.\./.test(p)) return send(res, 400, 'text/plain', 'bad path');
    return fs.readFile(p, function (err, data) {
      if (err) return send(res, 404, 'text/plain', 'not found');
      var type = /\.jpe?g$/i.test(p) ? 'image/jpeg' : /\.svg$/i.test(p) ? 'image/svg+xml' : 'image/png';
      send(res, 200, type, data);
    });
  }
  send(res, 404, 'text/plain', 'not found');
});
server.on('error', function () { /* port already in use: an earlier copy is running */ });
server.listen(PORT, '127.0.0.1');
