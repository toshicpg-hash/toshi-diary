// Preserve the reviewed 1.2.32 source order and exception boundaries.
// No dependencies, downloads, deployment or personal data are involved.
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const target='hub-app-1.2.33.js';
const template=fs.readFileSync(path.join(root,'hub-app-1.2.32.js'),'utf8');
const parts=template.split(/(;\/\* Source: [^ ]+ \*\/\n)/);
parts[0]=parts[0].replace('1.2.32','1.2.33');
for(let i=1;i<parts.length;i+=2){
 const name=/Source: ([^ ]+)/.exec(parts[i])[1];
 const source=fs.readFileSync(path.join(root,name),'utf8');
 if(name==='config.js')parts[i+1]=source+'\n\n';
 else {
  const suffix='\n} catch (error) { setTimeout(function () { throw error; }, 0); }\n';
  if(!parts[i+1].startsWith('try {\n')||!parts[i+1].includes(suffix))throw Error('Unknown wrapper: '+name);
  parts[i+1]='try {\n'+source+suffix+(i+2<parts.length?'\n':'');
 }
}
const output=parts.join('');
if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,target),output);
else if(fs.readFileSync(path.join(root,target),'utf8')!==output)throw Error('Bundle differs; run node scripts/build-bundle.cjs --write');
console.log(target+': '+(process.argv.includes('--write')?'generated':'matches all 43 ordered sources'));
