import config from './runtime-config.js';
import {createDemoApi} from './browser-demo.js';
let demo;
export async function request(url,options){
 if(config.mode==='browser-demo'){
  demo??=createDemoApi();
  return demo.request(url,options);
 }
 return globalThis.fetch(url,options);
}
