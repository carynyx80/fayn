import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const dirs=['scripts','services','shared','tests','simulation','web'];let count=0;
for(const dir of dirs)for(const file of fs.readdirSync(dir))if(/\.(mjs|js)$/.test(file)){const r=spawnSync(process.execPath,['--check',`${dir}/${file}`],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);process.exit(1);}count++;}
console.log(`JavaScript syntax checks: ${count} files passed.`);
