/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');
const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const baseUrl = 'http://127.0.0.1:3119';
const email = 'mgendy4+lnkdit-a@gmail.com';
const password = process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD;
const marker = `LNKDIT QA ${Date.now()}`;
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function run() {
  assert(password, 'Disposable account password is missing');
  const login = await client.auth.signInWithPassword({email,password});
  assert(!login.error && login.data.user, 'Disposable account login failed');
  const userId = login.data.user.id;
  const before = await client.from('cloud_profiles').select('profile_id').eq('user_id',userId);
  const workspace = await client.from('cloud_workspaces').select('user_id').eq('user_id',userId);
  assert(!before.error && !workspace.error && before.data.length===0 && workspace.data.length===0, 'Use an empty disposable account; existing work will not be touched');
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({acceptDownloads:true});
    const page = await context.newPage();
    page.setDefaultTimeout(180000);
    let analysisPassed=false, generationPassed=false;
    page.on('response', response => {
      if(response.url().endsWith('/api/analyze-structure') && response.ok()) analysisPassed=true;
      if(response.url().endsWith('/api/generate-profile') && response.ok()) generationPassed=true;
    });
    console.log('Stage: sign-in');
    await page.goto(`${baseUrl}/auth?next=%2Fcompany`);
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.waitForURL('**/company');
    await page.locator('input[placeholder^="e.g. ElShaarawy"]').fill(marker);
    await page.locator('textarea[placeholder="Tell us about the company..."]').fill('An interior design studio offering residential space planning, material selection and furniture selection. The studio has eight years of experience.');
    await page.locator('input[placeholder^="e.g. Professional services"]').fill('Interior Design Studio');
    await page.locator('input[placeholder^="e.g. Management Consulting"]').fill('Interior Design');
    await page.locator('input[placeholder^="e.g. B2B, consumers"]').fill('Residential clients');
    await page.locator('textarea[placeholder^="List the services"]').fill('Space planning, material selection, furniture selection');
    await page.locator('input[type="number"]').fill('8');
    await page.getByRole('button',{name:'Save Company',exact:true}).click();
    await page.waitForURL('**/generate');
    console.log('Stage: project upload');
    await page.goto(`${baseUrl}/projects`);
    await page.locator('input[placeholder="e.g. New Cairo Marble Project"]').fill('Residential design sample');
    await page.locator('textarea[placeholder="Describe the project..."]').fill('Residential space planning with natural materials and layered lighting.');
    await page.getByLabel('Upload Project Image (required)').setInputFiles(resolve('lib/test-fixtures/visual/aurelia-browser-upload.jpg'));
    await page.getByAltText('Featured project preview').waitFor();
    await page.getByRole('button',{name:'Save Project',exact:true}).click();
    await page.getByRole('heading',{name:'Saved Projects (1)'}).waitFor();
    await page.goto(`${baseUrl}/generate`);
    console.log('Stage: live AI analysis');
    await page.getByRole('button',{name:'Analyze Saved Company',exact:true}).click();
    await page.getByText(/tailored your profile structure/i).waitFor();
    await page.getByRole('button',{name:/This Looks Good|Structure Confirmed/}).click();
    console.log('Stage: live AI generation');
    await page.getByRole('button',{name:'Generate Profile',exact:true}).click();
    await page.getByText('Choose a template family',{exact:true}).waitFor();
    assert(analysisPassed && generationPassed,'Real AI endpoints did not both succeed');
    console.log('Stage: PDF export');
    const downloadReady=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download PDF',exact:true}).first().click();
    const download=await downloadReady;
    const bytes=await readFile(await download.path());
    assert(bytes.subarray(0,5).toString()==='%PDF-' && bytes.length>1000,'Invalid or empty PDF');
    await page.getByText('Synced',{exact:true}).first().waitFor();
    await context.close();
    const fresh=await browser.newContext();
    const returning=await fresh.newPage();
    returning.setDefaultTimeout(180000);
    await returning.goto(`${baseUrl}/auth?next=%2Fgenerate`);
    await returning.getByLabel('Email',{exact:true}).fill(email);
    await returning.getByLabel('Password',{exact:true}).fill(password);
    await returning.getByRole('button',{name:'Sign in',exact:true}).click();
    await returning.waitForURL('**/generate');
    await returning.getByRole('button',{name:'Download PDF',exact:true}).first().waitFor();
    console.log(JSON.stringify({status:'PASS',realAuth:true,realAI:true,imageUpload:true,pdfBytes:bytes.length,freshBrowserCloudRestore:true}));
    await fresh.close();
  } finally {
    await browser.close();
    // Only the uniquely named fixture is eligible for cleanup.
    const fixtures=await client.from('cloud_profiles').select('profile_id,company_data').eq('user_id',userId);
    assert(!fixtures.error,'Fixture lookup failed');
    for(const profile of fixtures.data.filter(row=>row.company_data?.name===marker)) {
      const prefix=`${userId}/${profile.profile_id}`;
      const files=await client.storage.from('customer-assets').list(prefix);
      assert(!files.error,'Fixture asset listing failed');
      if(files.data.length) assert(!(await client.storage.from('customer-assets').remove(files.data.map(file=>`${prefix}/${file.name}`))).error,'Fixture asset cleanup failed');
      assert(!(await client.from('cloud_workspaces').delete().eq('user_id',userId).eq('active_profile_id',profile.profile_id)).error,'Fixture workspace cleanup failed');
      assert(!(await client.from('cloud_profiles').delete().eq('user_id',userId).eq('profile_id',profile.profile_id)).error,'Fixture profile cleanup failed');
    }
    await client.auth.signOut();
  }
}
run().then(()=>process.exit(0)).catch(error=>{ console.error(error.message); process.exit(1); });
