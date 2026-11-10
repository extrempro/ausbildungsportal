import { spawn } from 'node:child_process';

/** Entwicklung: Oberfläche bei Änderungen neu bauen und den Server bei Änderungen neu starten. */
const start = (args: string[]) => spawn(process.execPath, ['--env-file-if-exists=.env', '--import', 'tsx', ...args], { stdio: 'inherit' });
const kinder = [start(['scripts/build.ts', '--watch']), start(['--watch-path=server', 'server/index.ts'])];

const ende = () => {
  for (const k of kinder) k.kill();
  process.exit(0);
};
process.on('SIGINT', ende);
process.on('SIGTERM', ende);
for (const k of kinder) k.on('exit', (code) => { if (code) ende(); });
