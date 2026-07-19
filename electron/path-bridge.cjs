function toWslPath(nativePath) {
  const normalized = String(nativePath || '').replace(/\\/g, '/');
  const drive = normalized.match(/^([A-Za-z]):\/(.*)$/);
  return drive ? `/mnt/${drive[1].toLowerCase()}/${drive[2]}` : normalized;
}

module.exports = { toWslPath };
