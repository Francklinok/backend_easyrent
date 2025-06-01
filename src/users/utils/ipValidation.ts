
// IP validation function that accepts both IPv4 and IPv6
export function validateIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex (simplified but covers most cases including ::1)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$|^::1$|^::$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  // Allow common localhost representations
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}
