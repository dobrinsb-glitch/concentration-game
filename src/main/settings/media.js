'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function inside(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relativePath);
  const comparableRoot = process.platform === 'win32' ? resolvedRoot.toLowerCase() : resolvedRoot;
  const comparable = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  if (comparable !== comparableRoot && !comparable.startsWith(`${comparableRoot}${path.sep}`)) {
    throw new Error('Media source is outside its allowed directory.');
  }
  return resolved;
}

function sourcePath(source, appPath, userDataPath) {
  if (source.startsWith('bundled:')) return inside(appPath, source.slice('bundled:'.length));
  if (source.startsWith('user:')) return inside(path.join(userDataPath, 'media'), source.slice('user:'.length));
  throw new Error('Unsupported media source.');
}

function hydrateSettings(settings, appPath, userDataPath, appVersion) {
  const media = (item) => ({
    ...item,
    url: pathToFileURL(sourcePath(item.source, appPath, userDataPath)).href
  });
  return {
    ...settings,
    rewards: settings.rewards.map(media),
    videos: settings.videos.map(media),
    appVersion
  };
}

function copyUserMedia(sourceFile, kind, userDataPath) {
  const extensions = kind === 'images'
    ? new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])
    : new Set(['.mp4', '.m4v', '.webm', '.mov']);
  const extension = path.extname(sourceFile).toLowerCase();
  if (!extensions.has(extension)) throw new Error(`Unsupported ${kind === 'images' ? 'image' : 'video'} format.`);
  const filename = `${crypto.randomUUID()}${extension}`;
  const folder = path.join(userDataPath, 'media', kind);
  fs.mkdirSync(folder, { recursive: true });
  fs.copyFileSync(sourceFile, path.join(folder, filename));
  return `user:${kind}/${filename}`;
}

module.exports = { copyUserMedia, hydrateSettings, sourcePath };
