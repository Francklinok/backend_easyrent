export function generateWatermark(contractId: string, options?: {
  text?: string;
  opacity?: number;
  color?: string;
  fontSize?: string;
  rotation?: number;
}): string {
  const {
    text = `CONTRAT ${contractId}`,
    opacity = 0.1,
    color = '#667eea',
    fontSize = '60px',
    rotation = -45
  } = options || {};

  return `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(${rotation}deg);
      opacity: ${opacity};
      font-size: ${fontSize};
      color: ${color};
      font-weight: bold;
      font-family: Arial, sans-serif;
      z-index: -1;
      user-select: none;
      pointer-events: none;
      white-space: nowrap;
    ">
      ${text}
    </div>
  `;
}

export function generateAdvancedWatermark(contractId: string, options?: {
  type?: 'diagonal' | 'grid' | 'stamp';
  status?: string;
  opacity?: number;
}): string {
  const {
    type = 'diagonal',
    status = 'ORIGINAL',
    opacity = 0.08
  } = options || {};

  switch (type) {
    case 'grid':
      return generateGridWatermark(contractId, status, opacity);
    case 'stamp':
      return generateStampWatermark(contractId, status, opacity);
    default:
      return generateDiagonalWatermark(contractId, status, opacity);
  }
}

function generateDiagonalWatermark(contractId: string, status: string, opacity: number): string {
  return `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: -1;
      pointer-events: none;
    ">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        opacity: ${opacity};
        font-size: 48px;
        color: #667eea;
        font-weight: bold;
        font-family: 'Arial', sans-serif;
        white-space: nowrap;
        text-transform: uppercase;
      ">
        ${status} • ${contractId}
      </div>
      <div style="
        position: absolute;
        top: 25%;
        left: 25%;
        transform: translate(-50%, -50%) rotate(-45deg);
        opacity: ${opacity * 0.5};
        font-size: 24px;
        color: #667eea;
        font-weight: 500;
        font-family: 'Arial', sans-serif;
        white-space: nowrap;
      ">
        DOCUMENT SÉCURISÉ
      </div>
      <div style="
        position: absolute;
        top: 75%;
        left: 75%;
        transform: translate(-50%, -50%) rotate(-45deg);
        opacity: ${opacity * 0.5};
        font-size: 24px;
        color: #667eea;
        font-weight: 500;
        font-family: 'Arial', sans-serif;
        white-space: nowrap;
      ">
        BLOCKCHAIN VERIFIED
      </div>
    </div>
  `;
}

function generateGridWatermark(contractId: string, status: string, opacity: number): string {
  const watermarkElements = [];

  // Créer une grille de watermarks
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const top = 15 + (row * 25);
      const left = 10 + (col * 30);

      watermarkElements.push(`
        <div style="
          position: absolute;
          top: ${top}%;
          left: ${left}%;
          transform: rotate(-25deg);
          opacity: ${opacity};
          font-size: 16px;
          color: #667eea;
          font-weight: 600;
          font-family: 'Arial', sans-serif;
          white-space: nowrap;
          text-transform: uppercase;
        ">
          ${contractId}
        </div>
      `);
    }
  }

  return `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: -1;
      pointer-events: none;
    ">
      ${watermarkElements.join('')}
    </div>
  `;
}

function generateStampWatermark(contractId: string, status: string, opacity: number): string {
  return `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: -1;
      pointer-events: none;
    ">
      <!-- Main stamp -->
      <div style="
        position: absolute;
        top: 20%;
        right: 10%;
        width: 180px;
        height: 120px;
        border: 3px solid #667eea;
        border-radius: 8px;
        opacity: ${opacity};
        transform: rotate(15deg);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: rgba(102, 126, 234, 0.02);
      ">
        <div style="
          font-size: 18px;
          font-weight: bold;
          color: #667eea;
          text-align: center;
          margin-bottom: 5px;
        ">
          ${status}
        </div>
        <div style="
          font-size: 12px;
          color: #667eea;
          text-align: center;
          font-family: monospace;
        ">
          ${contractId}
        </div>
        <div style="
          font-size: 10px;
          color: #667eea;
          text-align: center;
          margin-top: 5px;
        ">
          ${new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>

      <!-- Secondary stamp -->
      <div style="
        position: absolute;
        bottom: 15%;
        left: 15%;
        width: 150px;
        height: 80px;
        border: 2px dashed #667eea;
        border-radius: 6px;
        opacity: ${opacity * 0.7};
        transform: rotate(-10deg);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      ">
        <div style="
          font-size: 14px;
          font-weight: bold;
          color: #667eea;
          text-align: center;
        ">
          VÉRIFIÉ
        </div>
        <div style="
          font-size: 9px;
          color: #667eea;
          text-align: center;
          margin-top: 2px;
        ">
          BLOCKCHAIN SECURE
        </div>
      </div>
    </div>
  `;
}

export function generateCustomWatermark(options: {
  contractId: string;
  companyName?: string;
  logoUrl?: string;
  pattern?: 'dots' | 'lines' | 'hexagon';
  intensity?: 'light' | 'medium' | 'strong';
}): string {
  const {
    contractId,
    companyName = 'EasyRent',
    pattern = 'dots',
    intensity = 'light'
  } = options;

  const opacityMap = {
    light: 0.05,
    medium: 0.1,
    strong: 0.15
  };

  const opacity = opacityMap[intensity];

  const patternSVG = generatePattern(pattern, opacity);

  return `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      pointer-events: none;
    ">
      ${patternSVG}

      <!-- Company info -->
      <div style="
        position: absolute;
        bottom: 30px;
        right: 30px;
        opacity: ${opacity * 2};
        font-size: 12px;
        color: #667eea;
        font-family: Arial, sans-serif;
        text-align: right;
      ">
        <div style="font-weight: bold;">${companyName}</div>
        <div style="font-size: 10px; margin-top: 2px;">ID: ${contractId}</div>
      </div>
    </div>
  `;
}

function generatePattern(pattern: string, opacity: number): string {
  switch (pattern) {
    case 'lines':
      return `
        <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
          <defs>
            <pattern id="lines" patternUnits="userSpaceOnUse" width="40" height="40">
              <line x1="0" y1="20" x2="40" y2="20" stroke="#667eea" stroke-width="0.5" opacity="${opacity}"/>
              <line x1="20" y1="0" x2="20" y2="40" stroke="#667eea" stroke-width="0.5" opacity="${opacity}"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lines)"/>
        </svg>
      `;

    case 'hexagon':
      return `
        <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
          <defs>
            <pattern id="hexagon" patternUnits="userSpaceOnUse" width="60" height="52">
              <polygon points="30,2 50,15 50,37 30,50 10,37 10,15"
                       fill="none"
                       stroke="#667eea"
                       stroke-width="0.5"
                       opacity="${opacity}"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hexagon)"/>
        </svg>
      `;

    default: // dots
      return `
        <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
          <defs>
            <pattern id="dots" patternUnits="userSpaceOnUse" width="30" height="30">
              <circle cx="15" cy="15" r="1" fill="#667eea" opacity="${opacity}"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)"/>
        </svg>
      `;
  }
}

export default {
  generateWatermark,
  generateAdvancedWatermark,
  generateCustomWatermark
};