import axios from 'axios';

export interface LocationInfo {
  countryCode: string;
  country: string;
  city?: string;
  timezone?: string;
}

export class GeoLocationService {
  private static cache = new Map<string, LocationInfo>();

  static async detectCountryFromIP(ip: string): Promise<string> {
    const cleanIP = ip.replace(/^::ffff:/, '');
    
    if (cleanIP === '127.0.0.1' || cleanIP === 'localhost' || cleanIP.startsWith('192.168.')) {
      return 'TG'; 
    }

    // Vérifier le cache
    if (this.cache.has(cleanIP)) {
      return this.cache.get(cleanIP)!.countryCode;
    }

    try {
      const response = await axios.get(`https://ipapi.co/${cleanIP}/json/`, {
        timeout: 3000
      });

      const countryCode = response.data.country_code || 'TG';
      
      this.cache.set(cleanIP, {
        countryCode,
        country: response.data.country_name,
        city: response.data.city,
        timezone: response.data.timezone
      });

      return countryCode;
    } catch (error) {
      console.warn('[GeoLocation] Erreur détection pays:', error.message);
      return 'TG'; 
    }
  }

  static getClientIP(req: any): string {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           '127.0.0.1';
  }
}