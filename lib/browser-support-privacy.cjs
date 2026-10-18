/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {createClient}=require('@supabase/supabase-js');
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3126';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),b=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const marker=`LNKDIT support QA ${Date.now()}`;
async function run(){
  const aa=await a.auth.signInWithPassword({email:'mgendy4+lnkdit-a@gmail.com',password:process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD});
  const bb=await b.auth.signInWithPassword({email:'mgendy4+lnkdit-b@gmail.com',password:process.env.SUPABASE_TEST_ACCOUNT_B_PASSWORD});
  assert(!aa.error&&!bb.error,'Disposable account authentication failed');
  const headers={Authorization:`Bearer ${aa.data.session.access_token}`,'Content-Type':'application/json'};
  const browser=await chromium.launch({headless:true});
  try{
    assert.equal((await fetch(`${base}/api/support`)).status,401);
    const preflight=await a.from('support_requests').insert({user_id:aa.data.user.id,title:marker,message:'Disposable direct data API verification.'}).select('id').single();
    assert(!preflight.error,'Support data API insert failed: '+(preflight.error?.code??'')+' '+(preflight.error?.message??''));
    assert(!(await a.from('support_requests').delete().eq('id',preflight.data.id)).error,'Support preflight cleanup failed');
    const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(45000);
    await page.goto(`${base}/auth?next=%2Fsupport`);await page.getByLabel('Email',{exact:true}).fill('mgendy4+lnkdit-a@gmail.com');await page.getByLabel('Password',{exact:true}).fill(process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/support');
    await page.getByRole('heading',{name:'Support',exact:true}).waitFor();
    await page.getByLabel('Subject',{exact:true}).fill(marker);await page.getByLabel('What happened?',{exact:true}).fill('Disposable test message without customer information.');const submitted=page.waitForResponse(response=>response.url().endsWith('/api/support')&&response.request().method()==='POST');await page.getByRole('button',{name:'Send request',exact:true}).click();const sent=await submitted;const sentBody=await sent.json();assert.equal(sent.status(),201,'Support submit failed with code '+(sentBody.code??'unknown'));await page.getByText('Your request has been sent. Check this page for our reply.',{exact:true}).waitFor();
    const own=await (await fetch(`${base}/api/support`,{headers})).json();const ticket=own.requests.find(row=>row.title===marker);assert(ticket,'Submitted ticket missing');
    const other=await (await fetch(`${base}/api/support`,{headers:{Authorization:`Bearer ${bb.data.session.access_token}`}})).json();assert(!other.requests.some(row=>row.id===ticket.id),'Account B saw account A support content');
    assert.deepEqual((await b.from('support_requests').select('id').eq('id',ticket.id)).data,[]);
    assert((await b.from('support_requests').insert({user_id:aa.data.user.id,title:marker,message:'forged owner'})).error,'Forged support owner accepted');
    assert((await a.from('support_requests').update({reply:'forged administrator reply'}).eq('id',ticket.id)).error,'Customer could forge a support reply');
    assert.equal((await fetch(`${base}/api/support`,{method:'POST',headers,body:JSON.stringify({title:marker,message:'x'.repeat(4001)})})).status,400);
    for(let i=1;i<5;i++)assert.equal((await fetch(`${base}/api/support`,{method:'POST',headers,body:JSON.stringify({title:`${marker} ${i}`,message:'Disposable daily limit check.'})})).status,201);
    assert.equal((await fetch(`${base}/api/support`,{method:'POST',headers,body:JSON.stringify({title:`${marker} over limit`,message:'Must be rejected.'})})).status,429);
    await page.reload();await page.getByRole('heading',{name:marker,exact:true}).waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Support page overflows on mobile');
    console.log(JSON.stringify({status:'PASS',privateSupport:true,crossAccountIsolation:true,adminReplyProtected:true,dailyLimit:true,mobile:true}));
  }finally{
    await browser.close();const fixtures=await a.from('support_requests').select('id').like('title',`${marker}%`);assert(!fixtures.error,'Support fixture lookup failed');if(fixtures.data.length)assert(!(await a.from('support_requests').delete().in('id',fixtures.data.map(row=>row.id))).error,'Support fixture cleanup failed');await a.auth.signOut();await b.auth.signOut();
  }
}
run().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1)});
