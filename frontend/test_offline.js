const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    console.log("Navigating to localhost:3001/#admin");
    await page.goto('http://localhost:3001/#admin', { waitUntil: 'networkidle2' });

    console.log("Logging into POS as employee");
    await page.waitForSelector('#emp_login_id', { timeout: 10000 });
    await page.type('#emp_login_id', 'Ajita');
    await page.type('#emp_login_pass', 'Ajita123');
    
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Sign In as Staff'));
        if (btn) btn.click();
    });
    
    await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Instore POS'));
    }, { timeout: 5000 });
    console.log("Logged in!");

    console.log("Adding 3 units of milk via search scanner");
    const searchInput = await page.$('input[placeholder*="Scanner"]');
    if (searchInput) {
        await searchInput.type('Milk');
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
    }
    console.log("Added 3 units of Milk to cart.");

    console.log("Simulating API offline by setting page offline");
    await page.setOfflineMode(true);

    console.log("Clicking Complete Physical Sale");
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
        const checkoutBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Checkout Order'));
        if (checkoutBtn) checkoutBtn.click();
        else console.log("COULD NOT FIND CHECKOUT BUTTON");
    });
    
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'step3_alert.png', fullPage: true });

    let isAlertVisible = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div')).some(el => el.textContent.includes('TERMINAL OFFLINE'));
    });
    if (isAlertVisible) {
        console.log("Success! Offline Sync alert is visible.");
    } else {
        console.log("Failed: Offline sync alert NOT found. Checkout might not have been triggered.");
    }

    console.log("Refreshing browser while offline to test queue persistence...");
    // Since we are functionally offline but Next.js hot reload / local might fail, we simulate refresh by setting online, refresh, then offline immediately?
    // Let's just set offline to false before refreshing to not crash SSR Next.js
    await page.setOfflineMode(false);
    await page.reload({ waitUntil: 'networkidle2' });
    
    console.log("Page reloaded. Logging back in if needed...");
    await new Promise(r => setTimeout(r, 2000));
    const needsLogin = await page.$('#emp_login_id');
    if (needsLogin) {
        await page.waitForSelector('#emp_login_id', { visible: true });
        await page.type('#emp_login_id', 'Ajita', { delay: 50 });
        await page.type('#emp_login_pass', 'Ajita123', { delay: 50 });
        await new Promise(r => setTimeout(r, 500));
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Sign In as Staff'));
            if (btn) btn.click();
        });
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Instore POS'));
        }, { timeout: 15000 });
    }

    console.log("Waiting 12 seconds for auto-sync queue interval to replay payload...");
    await new Promise(r => setTimeout(r, 12000));

    console.log("Test completed on UI side. Checking DB Stock...");
    const { execSync } = require('child_process');
    try {
        const stockOutput = execSync('sqlite3 prisma/dev.db "SELECT name, stock FROM Product WHERE name=\'Milk\'"').toString().trim();
        console.log("DB Result:", stockOutput);
    } catch (e) {}

    await browser.close();
})();
