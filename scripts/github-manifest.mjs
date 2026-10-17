// Emit a reviewed UTF-8 source manifest for a Git tree upload. No credentials are read.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const roots=['api','contracts','docs','scripts','services','shared','simulation','tests','web'];
const rootFiles=['package.json','package-lock.json','vercel.json','README.md','hardhat.config.cjs','.gitignore','.npmrc','.env.example','.dockerignore','Dockerfile','compose.yaml'];
const entries=[];
function add(file){const bytes=fs.readFileSync(file),binary=/\.(ttf|woff2?|png)$/.test(file),content=bytes.toString(binary?'base64':'utf8');if(!binary&&/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{20,}/.test(content))throw Error(`Private key material in ${file}`);entries.push({path:file.replaceAll(path.sep,'/'),mode:'100644',type:'blob',content,...(binary?{encoding:'base64'}:{})});}
function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isSymbolicLink())throw Error(`Unexpected symlink ${file}`);if(e.isDirectory())visit(file);else add(file);}}
for(const file of rootFiles)add(file);for(const dir of roots)visit(dir);
const manifest=entries.map(e=>{const bytes=Buffer.from(e.content,e.encoding||'utf8');return {path:e.path,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
fs.writeFileSync('SOURCE-MANIFEST.json',JSON.stringify(manifest,null,2)+'\n');add('SOURCE-MANIFEST.json');
const blobs=Object.fromEntries(entries.map(e=>{const bytes=Buffer.from(e.content,e.encoding||'utf8');return [e.path,crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')];}));
const payload=JSON.stringify({entries,blobs});process.stdout.write(process.argv[2]===undefined?payload:payload.slice(Number(process.argv[2])*100000,(Number(process.argv[2])+1)*100000));
