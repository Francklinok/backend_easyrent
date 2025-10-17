import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';
import { Contract, ContractTemplate } from '../types';

interface PDFGenerationOptions {
  qrCodeData?: string;
  watermarkData?: string;
  customStyles?: string;
}

export async function generateContractPDF(
  contract: Contract,
  template: ContractTemplate,
  options: PDFGenerationOptions = {}
): Promise<string> {
  try {
    // Traiter le template HTML avec les variables du contrat
    const processedHTML = processTemplate(template.template, contract, options);

    // Générer le PDF avec Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Configurer la page
    await page.setContent(processedHTML, {
      waitUntil: 'networkidle0'
    });

    // Options de génération PDF
    const pdfOptions = {
      format: 'A4' as const,
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; text-align: center; width: 100%;">
          <span>Contrat ${contract.id} - ${new Date().toLocaleDateString('fr-FR')}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 10px; text-align: center; width: 100%;">
          <span>Page <span class="pageNumber"></span> sur <span class="totalPages"></span></span>
        </div>
      `
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    await browser.close();

    // Sauvegarder le fichier
    const fileName = `contract_${contract.id}_${Date.now()}.pdf`;
    const filePath = path.join(process.cwd(), 'uploads', 'contracts', fileName);

    // Créer le dossier s'il n'existe pas
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Écrire le fichier
    await fs.writeFile(filePath, pdfBuffer);

    return filePath;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

function processTemplate(
  template: string,
  contract: Contract,
  options: PDFGenerationOptions
): string {
  let processedTemplate = template;

  // Remplacer les variables du contrat
  Object.entries(contract.variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    const formattedValue = formatValue(key, value);
    processedTemplate = processedTemplate.replace(placeholder, formattedValue);
  });

  // Remplacer les informations des parties
  if (contract.parties) {
    contract.parties.forEach(party => {
      const rolePrefix = party.role.toUpperCase();
      const partyUser = (party as any).user;

      // Remplacer les informations utilisateur (mock pour l'instant)
      processedTemplate = processedTemplate.replace(
        new RegExp(`{{${rolePrefix}_NAME}}`, 'g'),
        partyUser?.fullName || 'N/A'
      );
      processedTemplate = processedTemplate.replace(
        new RegExp(`{{${rolePrefix}_EMAIL}}`, 'g'),
        partyUser?.email || 'N/A'
      );
      processedTemplate = processedTemplate.replace(
        new RegExp(`{{${rolePrefix}_PHONE}}`, 'g'),
        partyUser?.phone || 'N/A'
      );
    });
  }

  // Remplacer les informations de la propriété (si disponible)
  if (contract.propertyId) {
    // Mock data - à remplacer par des vraies données
    processedTemplate = processedTemplate.replace(/{{PROPERTY_TITLE}}/g, 'Propriété');
    processedTemplate = processedTemplate.replace(/{{PROPERTY_ADDRESS}}/g, 'Adresse');
    processedTemplate = processedTemplate.replace(/{{PROPERTY_SURFACE}}/g, '0');
    processedTemplate = processedTemplate.replace(/{{PROPERTY_ROOMS}}/g, '0');
  }

  // Ajouter le QR code et le watermark
  if (options.qrCodeData) {
    processedTemplate = processedTemplate.replace('{{QR_CODE}}', options.qrCodeData);
  } else {
    processedTemplate = processedTemplate.replace('{{QR_CODE}}', '');
  }

  if (options.watermarkData) {
    processedTemplate = processedTemplate.replace('{{WATERMARK}}', options.watermarkData);
  } else {
    processedTemplate = processedTemplate.replace('{{WATERMARK}}', '');
  }

  // Remplacer l'ID du contrat
  processedTemplate = processedTemplate.replace(/{{CONTRACT_ID}}/g, contract.id);

  // Ajouter les styles CSS par défaut
  const defaultStyles = `
    <style>
      body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .contract-header {
        text-align: center;
        margin-bottom: 30px;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
      }
      .contract-section {
        margin-bottom: 25px;
        padding: 15px;
        border-left: 4px solid #667eea;
        background-color: #f8f9fa;
      }
      .parties-container {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        margin: 20px 0;
      }
      .party-info {
        flex: 1;
        padding: 15px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .signature-section {
        margin-top: 50px;
        display: flex;
        justify-content: space-between;
        gap: 20px;
      }
      .signature-box {
        flex: 1;
        border: 2px dashed #ddd;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        border-radius: 8px;
      }
      .qr-code {
        position: fixed;
        bottom: 20px;
        right: 20px;
        opacity: 0.8;
      }
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        opacity: 0.1;
        font-size: 60px;
        color: #667eea;
        font-weight: bold;
        z-index: -1;
      }
      h1, h2, h3 {
        color: #667eea;
      }
      .contract-meta {
        font-size: 12px;
        color: #666;
        text-align: center;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #eee;
      }
      @media print {
        .contract-section {
          break-inside: avoid;
        }
        .signature-section {
          break-inside: avoid;
        }
      }
    </style>
  `;

  // Insérer les styles dans le head
  if (processedTemplate.includes('<head>')) {
    processedTemplate = processedTemplate.replace('<head>', `<head>${defaultStyles}`);
  } else {
    processedTemplate = `${defaultStyles}${processedTemplate}`;
  }

  // Ajouter les styles personnalisés si fournis
  if (options.customStyles) {
    processedTemplate = processedTemplate.replace('</head>', `<style>${options.customStyles}</style></head>`);
  }

  return processedTemplate;
}

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  // Formatage selon le type de variable
  if (key.toLowerCase().includes('date')) {
    return new Date(value).toLocaleDateString('fr-FR');
  }

  if (key.toLowerCase().includes('price') || key.toLowerCase().includes('rent') || key.toLowerCase().includes('amount')) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  return value.toString();
}

export default { generateContractPDF };