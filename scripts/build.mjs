import {sandboxFiles} from './sandbox-bundle.mjs';
import fs from 'node:fs';import path from 'node:path';import {build} from 'esbuild';
const root=path.resolve(process.cwd()),out=path.resolve(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Invalid build target');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of ['index.html','style.css','brand-mark.svg','fayn-logo.png'])fs.copyFileSync(path.join(root,'web',file),path.join(out,file));
fs.cpSync(path.join(root,'web/fonts'),path.join(out,'fonts'),{recursive:true});
// Use the official browser distribution unchanged, avoiding Node/browser export mismatches.
fs.copyFileSync(path.join(root,'node_modules/@walletconnect/sign-client/dist/index.umd.js'),path.join(out,'walletconnect.js'));
await build({absWorkingDir:root,entryPoints:[path.join(root,'scripts/qr-entry.mjs')],plugins:[sandboxFiles],tsconfigRaw:{compilerOptions:{}},bundle:true,format:'iife',globalName:'FaynQr',platform:'browser',target:'es2022',outfile:path.join(out,'qr-bundle.js'),minify:true});
const entry=fs.readFileSync(path.join(root,'scripts/wallet-entry.mjs'),'utf8').replace("import SignClient from '@walletconnect/sign-client';","const SignClient=window['@walletconnect/sign-client'].SignClient;").replace("import QRCode from 'qrcode';","const QRCode=FaynQr.default;");
fs.writeFileSync(path.join(out,'wallet-bundle.js'),entry);fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\n');console.log('Built Fayn partnership site with the official WalletConnect browser client.');
