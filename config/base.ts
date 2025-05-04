const  base =  {
  app: {
    name: 'easyrent',
    port: parseInt(process.env.PORT || '5000'),
    env: process.env.NODE_ENV || 'development',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    tokenExpiry: '7d',
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucketName: process.env.STORAGE_BUCKET || 'easyrent-local',
  },
  email: {
    service: process.env.EMAIL_SERVICE,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
  },
};
export default base