import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),out=path.resolve(root,'dist');
if(path.dirname(out)!==path.resolve(root)||path.basename(out)!=='dist')throw Error('Invalid output path');
fs.mkdirSync(out,{recursive:true});
for(const file of fs.readdirSync('web'))if(/\.(html|js|css|svg)$/.test(file))fs.copyFileSync(path.join('web',file),path.join(out,file));
fs.cpSync('web/fonts',path.join(out,'fonts'),{recursive:true});
fs.writeFileSync(path.join(out,'runtime-config.js'),"// Public static deployment: simulated browser state; no keys or backend.\nexport default Object.freeze({mode:'browser-demo'});\n");
fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\n');
console.log(`Built Vercel static application in ${out}. Hosted mode: clearly labeled browser simulation.`);
