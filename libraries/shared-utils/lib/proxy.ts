import { env } from './env';

export const generateOxylabsProxyList = (count: number) => {
  const proxyUrls: Array<string> = [];
  for (let i = 0; i < count; i++) {
    proxyUrls.push(
      //   `http://${proxyUsername}-${val}:${proxyPassword}@${proxyHost}:${proxyPort}`
      `http://customer-${env.PROXY_USERNAME}-sessid-${env.PROXY_SESSION_ID_PREFIX}${i.toString().padStart(3, '0')}-sesstime-${env.PROXY_SESSION_TIME}:${env.PROXY_PASSWORD}@${env.PROXY_HOST}:${env.PROXY_PORT}`
    );
  }
  return proxyUrls;
};

export const generateEvomiProxyList = () => {
  const proxyUrls: Array<string> = [];
  for (let i = 0; i < env.SESSION_COUNT; i++) {
    proxyUrls.push(
      //   `http://${proxyUsername}-${val}:${proxyPassword}@${proxyHost}:${proxyPort}`
      `http://${env.PROXY_USERNAME}:${env.PROXY_PASSWORD}_session-${env.PROXY_SESSION_ID_PREFIX}${i.toString().padStart(3, '0')}_lifetime-${env.PROXY_SESSION_TIME}@${env.PROXY_HOST}:${env.PROXY_PORT}`
    );
  }
  return proxyUrls;
};

export const evomiProxyURLList = generateEvomiProxyList();
