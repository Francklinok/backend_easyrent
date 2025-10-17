import QRCode from 'qrcode';
import { Contract } from '../types';

interface QRCodeData {
  contractId: string;
  propertyTitle?: string;
  tenantName?: string;
  startDate?: string;
  endDate?: string;
  verificationUrl?: string;
}

export async function generateQRCode(contractId: string, contract: Contract): Promise<string> {
  try {
    // Préparer les données pour le QR code
    const qrData: QRCodeData = {
      contractId: contract.id,
      propertyTitle: contract.variables.propertyTitle || 'N/A',
      tenantName: getTenantName(contract),
      startDate: contract.variables.startDate,
      endDate: contract.variables.endDate,
      verificationUrl: `${process.env.FRONTEND_URL}/verify-contract/${contract.id}`
    };

    // Créer le contenu JSON du QR code
    const qrContent = JSON.stringify(qrData);

    // Options de génération du QR code
    const qrOptions = {
      type: 'svg' as const,
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M' as const
    };

    // Générer le QR code en SVG
    const qrCodeSVG = await QRCode.toString(qrContent, qrOptions);

    // Ajouter un style personnalisé au SVG
    const styledQRCode = addQRCodeStyles(qrCodeSVG, contract);

    return styledQRCode;
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

export async function generateAdvancedQRCode(data: {
  contractId: string;
  propertyTitle: string;
  tenantName: string;
  startDate: string;
  endDate: string;
}): Promise<string> {
  try {
    const qrData = {
      ...data,
      verificationUrl: `${process.env.FRONTEND_URL || 'https://app.example.com'}/verify-contract/${data.contractId}`,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    const qrContent = JSON.stringify(qrData);

    const qrOptions = {
      type: 'svg' as const,
      width: 200,
      margin: 2,
      color: {
        dark: '#2563eb',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H' as const
    };

    const qrCodeSVG = await QRCode.toString(qrContent, qrOptions);

    // Créer un QR code amélioré avec bordure et informations
    const enhancedQRCode = `
      <div style="text-align: center; padding: 10px; border: 2px solid #2563eb; border-radius: 8px; background: white; display: inline-block;">
        ${qrCodeSVG}
        <div style="margin-top: 8px; font-size: 10px; color: #2563eb; font-weight: bold;">
          Contrat Sécurisé
        </div>
        <div style="font-size: 8px; color: #64748b; margin-top: 2px;">
          ID: ${data.contractId}
        </div>
        <div style="font-size: 8px; color: #64748b;">
          Scanné le: ${new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>
    `;

    return enhancedQRCode;
  } catch (error) {
    console.error('Advanced QR Code generation error:', error);
    throw new Error(`Failed to generate advanced QR code: ${error.message}`);
  }
}

export function verifyQRCodeData(qrContent: string): boolean {
  try {
    const data = JSON.parse(qrContent);

    // Vérifications de base
    if (!data.contractId) return false;
    if (!data.verificationUrl) return false;

    // Vérifier le format de l'URL
    try {
      new URL(data.verificationUrl);
    } catch {
      return false;
    }

    // Vérifier le timestamp si présent
    if (data.timestamp) {
      const timestamp = new Date(data.timestamp);
      const now = new Date();
      const daysDiff = (now.getTime() - timestamp.getTime()) / (1000 * 3600 * 24);

      // QR code valide pendant 365 jours
      if (daysDiff > 365) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function generateQRCodeWithLogo(contractId: string, contract: Contract, logoPath?: string): Promise<string> {
  try {
    const qrData = {
      contractId: contract.id,
      verificationUrl: `${process.env.FRONTEND_URL}/verify-contract/${contract.id}`,
      type: contract.type,
      status: contract.status,
      timestamp: new Date().toISOString()
    };

    const qrContent = JSON.stringify(qrData);

    const qrOptions = {
      type: 'svg' as const,
      width: 250,
      margin: 3,
      color: {
        dark: '#1e40af',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H' as const
    };

    let qrCodeSVG = await QRCode.toString(qrContent, qrOptions);

    // Ajouter un logo au centre si fourni
    if (logoPath) {
      // TODO: Implémenter l'insertion du logo au centre du QR code
      // Cela nécessite une manipulation plus avancée du SVG
    }

    // Ajouter un cadre décoratif
    const decoratedQRCode = `
      <div style="
        display: inline-block;
        padding: 15px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      ">
        <div style="
          background: white;
          padding: 10px;
          border-radius: 8px;
          text-align: center;
        ">
          ${qrCodeSVG}
          <div style="
            margin-top: 10px;
            font-size: 11px;
            color: #374151;
            font-weight: 600;
          ">
            Contrat Blockchain
          </div>
          <div style="
            font-size: 9px;
            color: #6b7280;
            margin-top: 2px;
          ">
            Sécurisé & Vérifiable
          </div>
        </div>
      </div>
    `;

    return decoratedQRCode;
  } catch (error) {
    console.error('QR Code with logo generation error:', error);
    throw new Error(`Failed to generate QR code with logo: ${error.message}`);
  }
}

function addQRCodeStyles(svgContent: string, contract: Contract): string {
  // Ajouter des styles et informations contextuelles au QR code
  const containerStyle = `
    <div style="
      display: inline-block;
      text-align: center;
      padding: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    ">
      ${svgContent}
      <div style="
        margin-top: 8px;
        font-size: 10px;
        color: #374151;
        font-weight: 500;
      ">
        Contrat ${contract.type.toUpperCase()}
      </div>
      <div style="
        font-size: 8px;
        color: #6b7280;
        margin-top: 2px;
      ">
        ${contract.id}
      </div>
    </div>
  `;

  return containerStyle;
}

function getTenantName(contract: Contract): string {
  const tenant = contract.parties?.find(p => p.role === 'tenant');
  return (tenant as any)?.user?.fullName || 'N/A';
}

export default {
  generateQRCode,
  generateAdvancedQRCode,
  verifyQRCodeData,
  generateQRCodeWithLogo
};