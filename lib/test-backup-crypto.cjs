/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';
const assert=require('node:assert/strict');
const {mkdtemp,writeFile,readFile,access,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {randomBytes}=require('node:crypto');
const {transform}=require('../scripts/backup-crypto.cjs');
(async()=>{const dir=await mkdtemp(join(tmpdir(),'lnkdit-backup-'));try{const plain=randomBytes(131072),key=randomBytes(32).toString('hex');await writeFile(join(dir,'source'),plain);await transform('encrypt',join(dir,'source'),join(dir,'backup'),key);await transform('decrypt',join(dir,'backup'),join(dir,'restored'),key);assert.deepEqual(await readFile(join(dir,'restored')),plain);await assert.rejects(transform('decrypt',join(dir,'backup'),join(dir,'wrong'),key+'wrong'));await assert.rejects(access(join(dir,'wrong')));const encrypted=await readFile(join(dir,'backup'));encrypted[100]^=1;await writeFile(join(dir,'tampered'),encrypted);await assert.rejects(transform('decrypt',join(dir,'tampered'),join(dir,'unsafe'),key));await assert.rejects(access(join(dir,'unsafe')));console.log('Backup encryption restore, wrong-key and tamper rejection passed.');}finally{await rm(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error.message);process.exitCode=1});
