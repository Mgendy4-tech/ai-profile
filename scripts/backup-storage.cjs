/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';
const {mkdir,writeFile}=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(process.argv[2]);
const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_BACKUP_SERVICE_ROLE_KEY;
const headers={apikey:key,Authorization:`Bearer ${key}`};
async function backup(){
  if(!base||!key)throw new Error('Backup storage credentials missing');
  await mkdir(root,{recursive:true,mode:0o700});const manifest=[];
  async function walk(prefix=''){
    for(let offset=0;;offset+=1000){
      const response=await fetch(`${base}/storage/v1/object/list/customer-assets`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({prefix,limit:1000,offset,sortBy:{column:'name',order:'asc'}})});
      if(!response.ok)throw new Error('Private asset listing failed');const entries=await response.json();
      for(const item of entries){
        if(typeof item.name!=='string'||item.name==='.'||item.name==='..'||item.name.includes('/')||item.name.includes('\\'))throw new Error('Unsafe asset path');
        const object=prefix?`${prefix}/${item.name}`:item.name;
        if(!item.id){await walk(object);continue;}
        const target=path.resolve(root,object);if(!target.startsWith(root+path.sep))throw new Error('Unsafe asset path');
        const file=await fetch(`${base}/storage/v1/object/authenticated/customer-assets/${object.split('/').map(encodeURIComponent).join('/')}`,{headers});
        if(!file.ok)throw new Error('Private asset download failed');const bytes=Buffer.from(await file.arrayBuffer());
        await mkdir(path.dirname(target),{recursive:true,mode:0o700});await writeFile(target,bytes,{flag:'wx',mode:0o600});
        manifest.push({path:object,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
      }
      if(entries.length<1000)break;
    }
  }
  await walk();await writeFile(path.join(root,'asset-manifest.json'),JSON.stringify(manifest),{mode:0o600});
  console.log(JSON.stringify({stage:'storage_backup',objects:manifest.length}));
}
backup().catch(()=>{console.error('Private storage backup failed. No raw provider response was logged.');process.exitCode=1});
