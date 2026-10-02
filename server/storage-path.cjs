'use strict';
const fs = require('node:fs'), path = require('node:path');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const validId = id => typeof id === 'string' && UUID.test(id);
const fail = (status, message) => Object.assign(new Error(message), { status });
// Check every component, including the storage root and Windows junctions.
// Missing paths are allowed for retry/reconciliation; existing links never are.
function storagePath(base, ...parts) {
  const root = path.resolve(base), target = path.resolve(root, ...parts);
  if (target !== root && !target.startsWith(root + path.sep)) throw fail(400, 'Invalid storage path');
  const relative = path.relative(path.parse(target).root, target).split(path.sep);
  let current = path.parse(target).root;
  for (const part of relative) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code === 'ENOENT') break; throw error; }
    if (stat.isSymbolicLink()) throw fail(400, 'Unsafe storage link');
  }
  return target;
}
function treeSize(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw fail(400, 'Unsafe storage link');
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) throw fail(400, 'Invalid storage item');
  return fs.readdirSync(target).reduce((sum, name) => sum + treeSize(path.join(target, name)), 0);
}
module.exports = { validId, storagePath, treeSize, fail };
