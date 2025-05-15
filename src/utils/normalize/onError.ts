import logger from '../logger/logger';
import  port from './normalizePort'

const onError = (error:NodeJS.ErrnoException):void =>{
    if(error.syscall !== 'listen'){
      throw error
    }
    const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;
  
    switch (error.code) {
      case 'EACCES':
        logger.error(`${bind} nécessite des privilèges élevés`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger.error(`${bind} est déjà utilisé`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  
  }
  export default  onError