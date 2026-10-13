// Local preview server: runs Eleventy's dev server from the project folder on port 8080.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'node_modules/@11ty/eleventy/cmd.cjs');
spawn(process.execPath, [cli, '--serve', '--port=8080'], { cwd: root, stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 0));
