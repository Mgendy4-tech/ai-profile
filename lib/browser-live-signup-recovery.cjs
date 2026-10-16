/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');
const baseUrl = 'http://127.0.0.1:3121';
const marker = `lnkdit-launch-${Date.now()}`;
const email = `mgendy4+${marker}@gmail.com`;
const password = randomBytes(30).toString('base64url');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
async function run() {
  const settingsResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}});
  const settings = await settingsResponse.json();
  assert(settingsResponse.ok && !settings.disable_signup, 'Public signup is disabled');
  assert(settings.mailer_autoconfirm === true, 'This test expects the current instant-signup mode; email verification needs an interactive test');
  const browser = await chromium.launch({headless:true});
  let userId;
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(`${baseUrl}/auth?next=%2Fcompany`);
    await page.getByRole('button',{name:'Create account',exact:true}).click();
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill(password);
    const signupResponse = page.waitForResponse(r=>r.url().includes('/auth/v1/signup'));
    await page.getByRole('button',{name:'Sign up',exact:true}).click();
    const response = await signupResponse;
    const body = await response.json();
    assert(response.ok() && body.user?.id, `Signup failed: HTTP ${response.status()} ${body.error_code??body.code??''}`);
    userId = body.user.id;
    console.log(JSON.stringify({stage:'fresh_signup',status:'PASS',userId,email,marker}));
    await page.waitForURL('**/company');
    await page.locator('input[placeholder^="e.g. ElShaarawy"]').fill(marker);
    await page.locator('textarea[placeholder="Tell us about the company..."]').fill('Disposable launch-readiness signup test.');
    await page.getByRole('button',{name:'Save Company',exact:true}).click();
    await page.waitForURL('**/generate');
    const login = await client.auth.signInWithPassword({email,password});
    assert(!login.error && login.data.user.id===userId, 'New user cannot sign in through the live auth API');
    let saved=false;
    for(let i=0;i<30;i++) {
      const row=await client.from('cloud_profiles').select('company_data').eq('user_id',userId);
      if(!row.error && row.data.some(p=>p.company_data?.name===marker)) {saved=true;break;}
      await page.waitForTimeout(1000);
    }
    assert(saved,'New user company was not saved privately to the cloud');
    await context.close();
    const fresh=await browser.newContext();
    const returning=await fresh.newPage();
    returning.setDefaultTimeout(45000);
    await returning.goto(`${baseUrl}/auth?next=%2Fcompany`);
    await returning.getByLabel('Email',{exact:true}).fill(email);
    await returning.getByLabel('Password',{exact:true}).fill(password);
    await returning.getByRole('button',{name:'Sign in',exact:true}).click();
    await returning.waitForURL('**/company');
    await returning.locator('input[placeholder^="e.g. ElShaarawy"]').filter({visible:true}).waitFor();
    await returning.waitForFunction(expected=>Array.from(document.querySelectorAll('input')).some(input=>input.value===expected),marker);
    console.log(JSON.stringify({stage:'fresh_session_cloud_restore',status:'PASS'}));
    const draftName = `${marker} draft`;
    await returning.locator('textarea[placeholder="Tell us about the company..."]').fill('Unsaved customer draft');
    await returning.locator('input[placeholder^="e.g. ElShaarawy"]').fill(draftName);
    await returning.evaluate(() => window.dispatchEvent(new CustomEvent('cloud-sync-status', {detail:{status:'synced'}})));
    await returning.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await returning.locator('input[placeholder^="e.g. ElShaarawy"]').inputValue(),draftName,'Late cloud hydration replaced a new company identity draft');
    assert.equal(await returning.locator('textarea[placeholder="Tell us about the company..."]').inputValue(),'Unsaved customer draft','Late cloud hydration erased an unsaved field');
    console.log(JSON.stringify({stage:'late_hydration_preserves_unsaved_draft',status:'PASS'}));
    await returning.goto(`${baseUrl}/auth`);
    await returning.getByRole('button',{name:'Sign out',exact:true}).click();
    await returning.getByRole('button',{name:'Forgot password?',exact:true}).waitFor();
    await returning.getByRole('button',{name:'Forgot password?',exact:true}).click();
    await returning.getByLabel('Email',{exact:true}).fill(email);
    // This runner is local, but the human recipient must land on the real site.
    await returning.route('**/auth/v1/recover**', route => {
      const target = new URL(route.request().url());
      target.searchParams.set('redirect_to', 'https://www.lnkdit.com/auth?mode=reset');
      return route.continue({url:target.toString()});
    });
    const recoveryResponse=returning.waitForResponse(r=>r.url().includes('/auth/v1/recover'));
    await returning.getByRole('button',{name:'Send reset email',exact:true}).click();
    const recovery=await recoveryResponse;
    const recoveryBody=await recovery.json().catch(()=>({}));
    console.log(JSON.stringify({stage:'password_recovery_request',status:recovery.ok()?'ACCEPTED_DELIVERY_UNVERIFIED':'BLOCKED',httpStatus:recovery.status(),code:recoveryBody.error_code??recoveryBody.code??null}));
    assert(recovery.ok(),'Password recovery email request failed; SMTP configuration must be resolved before public launch');
    await fresh.close();
  } finally {
    await browser.close();
    if(userId) {
      const fixtures=await client.from('cloud_profiles').select('profile_id,company_data').eq('user_id',userId);
      if(!fixtures.error) for(const profile of fixtures.data.filter(p=>p.company_data?.name===marker)) {
        assert(!(await client.from('cloud_workspaces').delete().eq('user_id',userId).eq('active_profile_id',profile.profile_id)).error,'Fixture workspace cleanup failed');
        assert(!(await client.from('cloud_profiles').delete().eq('user_id',userId).eq('profile_id',profile.profile_id)).error,'Fixture profile cleanup failed');
      }
      await client.auth.signOut();
      console.log(JSON.stringify({stage:'disposable_account_ready_for_removal',userId,email,marker}));
    }
  }
}
run().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1)});
