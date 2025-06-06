/**
 * Build helper scripts
 * Usage: node build.mjs [options] -- [rollup options]
 *
 * Options:
 * target[:<moduleFormat>][:<buildType>][:<bundleState>] - Specify the target
 *     - moduleFormat (esm, umd)
 *     - buildType (release, debug, profiler, min)
 *     - bundleState (unbundled, bundled)
 * Example: target:esm:release:bundled
 *
 * treemap - Enable treemap build visualization (release only).
 * treenet - Enable treenet build visualization (release only).
 * treesun - Enable treesun build visualization (release only).
 * treeflame - Enable treeflame build visualization (release only).
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);

const ENV_START_MATCHES = [
    'target',
    'treemap',
    'treenet',
    'treesun',
    'treeflame'
];

const env = [];
for (let i = 0; i < args.length; i++) {
    if (ENV_START_MATCHES.some(match => args[i].startsWith(match)) && args[i - 1] !== '--environment') {
        env.push(`--environment ${args[i]}`);
        args.splice(i, 1);
        i--;
        continue;
    }
}

const cmd = `rollup -c ${args.join(' ')} ${env.join(' ')}`;
try {
    execSync(cmd, { stdio: 'inherit' });
} catch (e) {
    console.error(e.message);
}
