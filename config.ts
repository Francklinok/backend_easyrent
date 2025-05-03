require('dotenv').config()

const  env = process.env.NODE_ENV || 'developpement';
const baseConfig = {
app:{
    name:'easyrent',
    port:parseInt(process.env.PORT)||  5000,
    env,
},
database:{
    uri:process.env.MONGO_URI,
},
auth:{
    jwtSecret:process.env.JWT_SECRET,
    tokenExpiry:'7d',

},
storage:{
    provider:process.env.STORAGE_PROVIDER || 'local',
    bucketName:process.env.STORAGE_BUCKET || 'easyrent-local',

},
email:{
    service:process.env.EMAIL_SERViCE,
    user:process.env.EMAIL_USER,
    password:process.env.EMAIL_PASS,
},
logging:{
    level: env === 'production' ? 'error':'debug',
    format:env ==='production'?'combined': 'dev '
}
};

const  envConfig = {
    developpement:{
        database:{
            uri:'mongodb.......................'
        }
    },
    production:{
        database:{
            uri:process.env.MONGO_URI,        
        },
        logging:{
            level:'warn',
            format:'combined',
        }
    }
}


module.exports = {
    ...baseConfig,
    ...(envConfig[env] || {})
}