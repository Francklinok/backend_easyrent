import base from './base';
import  dev from './env/developpement'
import  prod from './env/production'


const env = process.env.NODE_ENV || 'development';

const envConfig = {
  development: dev,
  production: prod,
};

export default {
  ...base,
  ...(envConfig[env] || {}),
};
