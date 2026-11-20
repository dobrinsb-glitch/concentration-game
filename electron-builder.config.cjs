'use strict';

const repository = process.env.GITHUB_REPOSITORY;
const [owner, repo] = repository ? repository.split('/') : [];

module.exports = {
  appId: 'world.maxmila.concentrationgame',
  productName: "Max and Mila's World",
  directories: {
    output: 'dist'
  },
  files: [
    'src/**/*',
    'assets/**/*',
    'Video/**/*',
    'package.json'
  ],
  asar: true,
  asarUnpack: [
    'Video/**/*'
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    artifactName: 'Max-and-Mila-Setup-${version}.${ext}'
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Max and Mila's World"
  },
  publish: owner && repo ? [{
    provider: 'github',
    owner,
    repo,
    releaseType: 'release'
  }] : undefined
};
