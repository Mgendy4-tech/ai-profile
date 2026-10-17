/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const {chromium,webkit} = require('playwright-core');
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3123';
const email = 'mgendy4+lnkdit-a@gmail.com';
const password = process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD;
const luminance = color => {
  const rgb=color.match(/[\d.]+/g).slice(0,3).map(x=>Number(x)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
};
async function signIn(page, suffix='') {
  await page.goto(`${base}/auth${suffix}`);
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
async function run() {
  assert(password,'Disposable account credentials missing');
  for(const [engine,type] of Object.entries({chromium,webkit})) {
    const browser=await type.launch({headless:true});
    try {
      const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark'});
      const page=await context.newPage();
      page.setDefaultTimeout(45000);
      await page.goto(`${base}/auth`);
      await page.getByLabel('Email',{exact:true}).fill(email);
      await page.getByLabel('Password',{exact:true}).fill(password);
      for(const colorScheme of ['dark','light']) {
        await page.emulateMedia({colorScheme});
        const styles=await page.locator('input').evaluateAll(inputs=>inputs.map(input=>{const c=getComputedStyle(input);return{color:c.color,fill:c.webkitTextFillColor,bg:c.backgroundColor,size:parseFloat(c.fontSize)}}));
        for(const style of styles) {
          const contrast=(Math.max(luminance(style.fill),luminance(style.bg))+0.05)/(Math.min(luminance(style.fill),luminance(style.bg))+0.05);
          assert(contrast>=4.5,`${engine} ${colorScheme}: auth input contrast ${contrast}`);
          assert(style.size>=16,`${engine}: mobile auth input may trigger unwanted zoom`);
        }
      }
      await page.getByRole('button',{name:'Sign in',exact:true}).click();
      await page.waitForURL(`${base}/`);
      await page.getByRole('heading',{name:'Professional company profiles, made easier.',exact:true}).waitFor();
      await page.getByRole('link',{name:'Account',exact:true}).waitFor();
      await page.getByRole('link',{name:/Create your profile|Continue with/}).first().click();
      await page.waitForURL('**/company');
      await page.goto(`${base}/auth?mode=reset`);
      assert.equal(await page.getByRole('button',{name:'Update password',exact:true}).count(),0,'Ordinary session bypassed recovery verification');
      await page.getByText(/open the password-reset link from your email/i).first().waitFor();
      await page.goto(`${base}/settings`);
      await page.getByRole('button',{name:'Sign out',exact:true}).click();
      await signIn(page,'?next=%2Fcompany');
      await page.waitForURL('**/company');
      await page.goto(`${base}/settings`);
      await page.getByRole('button',{name:'Sign out',exact:true}).click();
      await page.goto(`${base}/auth?mode=reset#error=access_denied&error_code=otp_expired`);
      assert.equal(await page.getByRole('button',{name:'Update password',exact:true}).count(),0,'Expired recovery link exposed password update');
      console.log(JSON.stringify({engine,status:'PASS',mobileContrast:true,defaultLoginHomepage:true,createWithoutLogoDetour:true,explicitNextPreserved:true,recoveryGuard:true}));
      await context.close();
    } finally {await browser.close();}
  }
}
run().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1)});
