import {sandboxFiles} from './sandbox-bundle.mjs';
import fs from 'node:fs';import path from 'node:path';import {build} from 'esbuild';
const root=path.resolve(process.cwd()),out=path.resolve(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Invalid build target');
// Only this validated project build directory is replaced; no source is removed.
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of ['index.html','style.css','brand-mark.svg'])fs.copyFileSync(path.join(root,'web',file),path.join(out,file));
fs.cpSync(path.join(root,'web/fonts'),path.join(out,'fonts'),{recursive:true});
await build({absWorkingDir:root,entryPoints:[path.join(root,'scripts/wallet-entry.mjs')],plugins:[sandboxFiles],tsconfigRaw:{compilerOptions:{}},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(out,'wallet-bundle.js'),minify:true});
fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\n');
console.log('Built read-only Fayn preview. No simulation assets or transaction controls are shipped.');
