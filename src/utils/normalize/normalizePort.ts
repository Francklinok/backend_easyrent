import config from "../../../config";
/**
 * Normalise le port en valeur numérique ou chaîne
 * @param val Valeur du port à normaliser
 * @returns Port normalisé ou false si invalide
 */

const normalizePort = (val:string | number): number | string | boolean =>{
    const port = typeof val ==='string'? parseInt(val,10):val;
    
    if(isNaN(port)){
      return val;
    }
    
    if(port  >= 0){
      return   port
    }
    
    return  false
    }

  const port = normalizePort(config.app.port || process.env.PORT || '3000' );
  export default port

