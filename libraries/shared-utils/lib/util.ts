import { createHash } from 'node:crypto';

export const generateHash = (value: string) => {
  return createHash('md5').update(value).digest('hex');
};
