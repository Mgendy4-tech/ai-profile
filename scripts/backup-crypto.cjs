/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';
const {open,rename,rm} = require('node:fs/promises');
const {createReadStream,createWriteStream} = require('node:fs');
const {createCipheriv,createDecipheriv,randomBytes,scryptSync} = require('node:crypto');
const {pipeline} = require('node:stream/promises');
const magic=Buffer.from('LNKDITBACKUP1');
async function transform(mode,input,output,password) {
  if(typeof password!=='string'||password.length<32)throw new Error('A backup key of at least 32 characters is required');
  if(input===output)throw new Error('Input and output must differ');
  const partial=`${output}.${randomBytes(8).toString('hex')}.partial`;
  const derive=salt=>scryptSync(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  try {
    if(mode==='encrypt') {
      const salt=randomBytes(16),iv=randomBytes(12);
      const header=Buffer.concat([magic,salt,iv]);
      const cipher=createCipheriv('aes-256-gcm',derive(salt),iv);cipher.setAAD(header);
      const file=await open(partial,'wx',0o600);await file.write(header);await file.close();
      await pipeline(createReadStream(input),cipher,createWriteStream(partial,{flags:'a',mode:0o600}));
      const tail=await open(partial,'a');await tail.write(cipher.getAuthTag());await tail.close();
    }else if(mode==='decrypt'){
      const file=await open(input,'r');let stat,header,tag;
      try{stat=await file.stat();header=Buffer.alloc(magic.length+28);tag=Buffer.alloc(16);if(stat.size<header.length+16)throw new Error('Invalid backup archive');await file.read(header,0,header.length,0);await file.read(tag,0,16,stat.size-16);}finally{await file.close();}
      if(!header.subarray(0,magic.length).equals(magic))throw new Error('Invalid backup archive');
      const salt=header.subarray(magic.length,magic.length+16),iv=header.subarray(magic.length+16);
      const decipher=createDecipheriv('aes-256-gcm',derive(salt),iv);decipher.setAAD(header);decipher.setAuthTag(tag);
      await pipeline(createReadStream(input,{start:header.length,end:stat.size-17}),decipher,createWriteStream(partial,{flags:'wx',mode:0o600}));
    }else throw new Error('Use encrypt or decrypt');
    // Publish a decrypted file only after authentication succeeds.
    const existing=await open(output,'wx',0o600);await existing.close();
    await rename(partial,output);
  }catch(error){await rm(partial,{force:true});throw error;}
}
module.exports={transform};
if(require.main===module){const [mode,input,output]=process.argv.slice(2);transform(mode,input,output,process.env.LNKDIT_BACKUP_KEY).catch(()=>{console.error('Backup encryption/decryption failed; no plaintext output was published.');process.exitCode=1;});}
