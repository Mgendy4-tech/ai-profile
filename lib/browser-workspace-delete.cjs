/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const {randomBytes} = require('node:crypto');
const {chromium,webkit} = require('playwright-core');
const {createClient} = require('@supabase/supabase-js');
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3124';
const marker = `lnkdit-delete-${Date.now()}`;
const email = `mgendy4+${marker}@gmail.com`;
const password = randomBytes(30).toString('base64url');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let userId;
const waitCloud = async count => {
  for(let i=0;i<45;i++) {
    const result=await client.from('cloud_profiles').select('profile_id').eq('user_id',userId);
    assert(!result.error,'Cannot read disposable account workspace');
    if(result.data.length===count) return;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error(`Cloud profile count did not reach ${count}`);
};
const login = async page => {
  await page.goto(`${base}/auth?next=%2Fworkspace`);
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL('**/workspace');
  await page.getByText('Synced',{exact:true}).waitFor();
};
const cards = page => page.getByRole('region',{name:'Saved company profiles'}).locator('article');
const waitCards = async (page,count) => {
  await page.waitForFunction(expected=>document.querySelectorAll('section[aria-label="Saved company profiles"] article').length===expected,count);
};
const removeFirst = async page => {
  page.once('dialog',dialog=>dialog.accept());
  await cards(page).first().getByRole('button',{name:'Delete',exact:true}).click();
};
async function run() {
  const signup=await client.auth.signUp({email,password});
  assert(!signup.error && signup.data.session,'Disposable signup unavailable');
  userId=signup.data.user.id;
  console.log(JSON.stringify({stage:'disposable_signup',userId,email}));
  try {
    for(const [engine,type] of Object.entries({chromium,webkit})) {
      const browser=await type.launch({headless:true});
      try {
        const context=await browser.newContext({viewport:{width:390,height:844}});
        const page=await context.newPage();
        page.setDefaultTimeout(45000);
        await login(page);
        if(await cards(page).count()===0) {
          await page.getByRole('button',{name:'Create new profile',exact:true}).click();
          await page.waitForURL('**/company');
          await page.goto(`${base}/workspace`);
        }
        await waitCards(page,1);
        await cards(page).first().getByRole('button',{name:'Duplicate',exact:true}).click();
        await waitCards(page,2);
        await waitCloud(2);
        await removeFirst(page);
        await waitCards(page,1);
        await waitCloud(1);
        await removeFirst(page);
        await waitCards(page,0);
        await waitCloud(0);
        await page.getByText('0 of 10 profiles used',{exact:true}).waitFor();
        assert.equal(await page.getByRole('link',{name:'Continue with the active profile',exact:true}).count(),0);
        await page.reload();
        await page.getByText('Synced',{exact:true}).waitFor();
        await waitCards(page,0);
        await context.close();
        const fresh=await browser.newContext({viewport:{width:390,height:844}});
        const returning=await fresh.newPage();
        returning.setDefaultTimeout(45000);
        await login(returning);
        await waitCards(returning,0);
        await returning.getByRole('button',{name:'Create new profile',exact:true}).click();
        await returning.waitForURL('**/company');
        await returning.locator('input[placeholder^="e.g. ElShaarawy"]').fill(`${marker} ${engine}`);
        await returning.locator('textarea[placeholder="Tell us about the company..."]').fill('Disposable profile deletion regression test.');
        await returning.getByRole('button',{name:'Save Company',exact:true}).click();
        await returning.waitForURL('**/generate');
        await waitCloud(1);
        await returning.goto(`${base}/workspace`);
        await waitCards(returning,1);
        await removeFirst(returning);
        await waitCards(returning,0);
        await waitCloud(0);
        await fresh.close();
        console.log(JSON.stringify({engine,status:'PASS',twoToOneToZero:true,reloadStaysEmpty:true,freshLoginStaysEmpty:true,createAfterDeletion:true}));
      } finally {await browser.close();}
    }
  } finally {
    assert(!(await client.from('cloud_profiles').delete().eq('user_id',userId)).error,'Disposable profile cleanup failed');
    assert(!(await client.from('cloud_workspaces').delete().eq('user_id',userId)).error,'Disposable workspace cleanup failed');
    await client.auth.signOut();
    console.log(JSON.stringify({stage:'disposable_account_ready_for_removal',userId,email}));
  }
}
run().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1)});
