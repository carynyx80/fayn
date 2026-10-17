import {spawn} from 'node:child_process';import path from 'node:path';import fs from 'node:fs';
const local=path.resolve('runtime/tooling');fs.mkdirSync(local,{recursive:true});
const child=spawn(process.execPath,['node_modules/hardhat/internal/cli/cli.js','node','--hostname','127.0.0.1'],{stdio:'inherit',env:{...process.env,APPDATA:local,LOCALAPPDATA:local,HARDHAT_TELEMETRY_CONSENT:'false'}});
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());child.on('exit',code=>process.exit(code||0));
