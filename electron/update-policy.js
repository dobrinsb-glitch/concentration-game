'use strict';

const SCOPES = new Set(['patch', 'minor', 'major']);

function numericVersion(version) {
  const match = String(version).trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function isUpdateAllowed(currentVersion, candidateVersion, requestedScope) {
  const current = numericVersion(currentVersion);
  const candidate = numericVersion(candidateVersion);
  const scope = SCOPES.has(requestedScope) ? requestedScope : 'patch';

  if (!current || !candidate || compareVersions(candidate, current) <= 0) return false;
  if (scope === 'major') return true;
  if (candidate[0] !== current[0]) return false;
  if (scope === 'minor') return true;
  return candidate[1] === current[1];
}

module.exports = { isUpdateAllowed, numericVersion };
