const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const AdmZip = require('adm-zip');
const chalk = new (require('chalk').Chalk)();


puppeteer.use(StealthPlugin());

async function downloadGallery({ url, limit = null, outputDir = 'downloads' }) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const imagePageUrls = await page.$$eval('a[href*="/i/"]', links =>
      [...new Set(links.map(link => link.href))]
    );

    console.log(`🔍 Found ${imagePageUrls.length} image pages.`);

    const maxImages = limit || imagePageUrls.length;
    const downloadFolder = path.join(process.cwd(), outputDir);
    fs.mkdirSync(downloadFolder, { recursive: true });

    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar.start(maxImages, 0);

    for (let i = 0; i < maxImages && i < imagePageUrls.length; i++) {
      const imgPageUrl = imagePageUrls[i];
      const imgPage = await browser.newPage();

      try {
        await imgPage.goto(imgPageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Handle continue
        try {
          await imgPage.waitForSelector(
            'form[action][method="POST"], input#continuebutton[type="submit"]',
            { timeout: 5000 }
          );

          const hasInput = await imgPage.$('input#continuebutton[type="submit"]');
          const hasForm = await imgPage.$('form[action][method="POST"]');

          if (hasInput) {
            await Promise.all([
              imgPage.click('input#continuebutton'),
              imgPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
            ]);
          } else if (hasForm) {
            await imgPage.evaluate(() => {
              const form = document.querySelector('form[action][method="POST"]');
              const btn = form?.querySelector('[type="submit"]');
              if (btn) btn.click();
            });

            await Promise.race([
              imgPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
              imgPage.waitForSelector('a[href$=".jpg"], img[src$=".jpg"]', { timeout: 10000 }),
            ]);
          }
        } catch (e) {
          // no continue
        }

        let imageHref = await imgPage.evaluate(() => {
          const link = document.querySelector('a[href$=".jpg"]');
          return link?.href || null;
        });

        if (!imageHref) {
          imageHref = await imgPage.evaluate(() => {
            const img = document.querySelector('img[src$=".jpg"]');
            return img?.src || null;
          });
        }

        if (!imageHref) throw new Error('No .jpg found');

        const filename = `full_image_${i + 1}.jpg`;
        const filepath = path.join(downloadFolder, filename);

        const writer = fs.createWriteStream(filepath);
        const response = await axios.get(imageHref, { responseType: 'stream' });
        response.data.pipe(writer);
        await new Promise((res, rej) => {
          writer.on('finish', res);
          writer.on('error', rej);
        });

        bar.increment();
      } catch (err) {
        console.error(`❌ Skipped ${imgPageUrl}:`, err.message);
      } finally {
        await imgPage.close();
      }
    }

    bar.stop();

    // Zip it
    const zip = new AdmZip();
    zip.addLocalFolder(downloadFolder);
    const zipPath = path.join(process.cwd(), `${outputDir}.zip`);
    zip.writeZip(zipPath);

    console.log(chalk.green(`✅ Zipped to ${zipPath}`));
  } catch (err) {
    console.error('🔥 Fatal error:', err.message);
  } finally {
    await browser.close();
  }
}

module.exports = downloadGallery;
