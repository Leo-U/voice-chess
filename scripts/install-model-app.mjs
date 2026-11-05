import {spawnSync} from 'node:child_process';
const result=spawnSync('pnpm',['install','--no-frozen-lockfile'],{stdio:'inherit'});
process.exit(result.status??1);
