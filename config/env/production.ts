const  prod = {
database:{
    uri:process.env.MONGO_URI,
},
logging:{
    level:'warn',
    format:'combined'
}
}

export default prod