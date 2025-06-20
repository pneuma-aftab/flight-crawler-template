import { exec } from 'child_process';
import type { CDPSession, Page } from 'puppeteer';

const chromeExecutable = 'google-chrome';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const openDevtools = async (page: Page, client: CDPSession) => {
  // get current frameId
  //@ts-expect-error Invalid Id Parameter
  const frameId = page.mainFrame()._id;
  // get URL for devtools from scraping browser
  //@ts-expect-error Invalid Page.Inspect Command
  const { url: inspectUrl } = await client.send('Page.inspect', { frameId });
  // open devtools URL in local chrome
  exec(`"${chromeExecutable}" "${inspectUrl}"`, (error) => {
    if (error) throw new Error('Unable to open devtools: ' + error);
  });
  // wait for devtools ui to load
  await delay(10000);
};

export const blockResources = async (client: CDPSession) => {
  await client.send('Network.setBlockedURLs', {
    urls: [
      // '.css',
      '.jpg',
      '.jpeg',
      '.png',
      '.svg',
      '.gif',
      '.woff',
      '.woff2',
      'adrum-latest.js',
      'js-agent.newrelic.com',
      'utag.sync.js',
      'detector-dom.min.js',
      'www.googletagmanager.com',
      'ytc.js',
      'bat.js',
      'visitor-service.tealiumiq.com',
      'connect.facebook.net',
      'p.teads.tv',
      'analytics.tiktok.com',

      // '.pdf',
      // '.zip',
    ],
  });
};
