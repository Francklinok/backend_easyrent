/**
 * Normalise le port en valeur numérique
 * @param val Valeur du port à normaliser
 * @returns Port normalisé (number) ou undefined si invalide
 */
function normalizePort(val: string | number): number {
  const port = typeof val === 'string' ? parseInt(val, 10) : val;

  if (isNaN(port) || port < 0) {
    throw new Error('Port invalide');
  }

  return port;
}

export default normalizePort;





