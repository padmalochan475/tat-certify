/**
 * PDF Generation Service
 * Handles PDF generation with QR codes and R2 upload
 */

import QRCode from 'qrcode';

export interface QRSettings {
  enabled: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: number;
}

export interface PDFGenerationOptions {
  html: string;
  qrCode?: string | null;
  qrSettings?: QRSettings;
  watermark?: string | null;
}

/**
 * Generate QR code as data URL
 */
export async function generateQRCode(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error('QR code generation failed:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate PDF from HTML
 * Uses external PDF service or Cloudflare Browser Rendering API
 */
export async function generatePDF(options: PDFGenerationOptions): Promise<ArrayBuffer> {
  const { html, qrCode, qrSettings, watermark } = options;

  // Inject QR code into HTML if enabled
  let finalHtml = html;
  if (qrCode && qrSettings?.enabled) {
    const qrPosition = qrSettings.position || 'bottom-right';
    const qrSize = qrSettings.size || 100;
    
    const qrHtml = `
      <div style="position: absolute; ${getQRPositionStyles(qrPosition)}; z-index: 1000;">
        <img src="${qrCode}" width="${qrSize}" height="${qrSize}" alt="QR Code" />
      </div>
    `;
    
    finalHtml = html.replace('</body>', `${qrHtml}</body>`);
  }

  // Add watermark if provided
  if (watermark) {
    const watermarkHtml = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); 
                  font-size: 72px; color: rgba(0,0,0,0.1); font-weight: bold; z-index: 999; pointer-events: none;">
        ${watermark}
      </div>
    `;
    finalHtml = finalHtml.replace('</body>', `${watermarkHtml}</body>`);
  }

  // For now, we'll use a mock PDF generation
  // In production, this would call an external PDF service or use Cloudflare Browser Rendering API
  
  // Option 1: External PDF service (e.g., Puppeteer microservice)
  // const response = await fetch('https://pdf-service.example.com/generate', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ html: finalHtml })
  // });
  // return response.arrayBuffer();

  // Option 2: Mock PDF for development
  // In production, replace this with actual PDF generation
  const mockPDF = createMockPDF(finalHtml);
  return mockPDF;
}

/**
 * Get CSS position styles for QR code placement
 */
function getQRPositionStyles(position: string): string {
  switch (position) {
    case 'bottom-right':
      return 'bottom: 20px; right: 20px';
    case 'bottom-left':
      return 'bottom: 20px; left: 20px';
    case 'top-right':
      return 'top: 20px; right: 20px';
    case 'top-left':
      return 'top: 20px; left: 20px';
    default:
      return 'bottom: 20px; right: 20px';
  }
}

/**
 * Create a mock PDF for development
 * In production, this should be replaced with actual PDF generation
 */
function createMockPDF(html: string): ArrayBuffer {
  // Create a simple PDF-like structure
  const pdfHeader = '%PDF-1.4\n';
  const pdfContent = `
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj

4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
endobj

5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Certificate Generated) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
0000000304 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
398
%%EOF
`;

  const pdfString = pdfHeader + pdfContent;
  const encoder = new TextEncoder();
  return encoder.encode(pdfString).buffer;
}

/**
 * Upload PDF to R2 storage
 */
export async function uploadToR2(
  r2Bucket: R2Bucket,
  key: string,
  data: ArrayBuffer,
  metadata?: Record<string, string>
): Promise<string> {
  try {
    await r2Bucket.put(key, data, {
      httpMetadata: {
        contentType: 'application/pdf',
        contentDisposition: `attachment; filename="${key.split('/').pop()}"`,
      },
      customMetadata: metadata || {},
    });

    // Return the public URL (in production, this would be your R2 custom domain)
    return `https://certificates.tat.ac.in/${key}`;
  } catch (error) {
    console.error('R2 upload failed:', error);
    throw new Error('Failed to upload PDF to storage');
  }
}

/**
 * Get PDF from R2 storage
 */
export async function getFromR2(r2Bucket: R2Bucket, key: string): Promise<ArrayBuffer | null> {
  try {
    const object = await r2Bucket.get(key);
    if (!object) {
      return null;
    }
    return await object.arrayBuffer();
  } catch (error) {
    console.error('R2 retrieval failed:', error);
    return null;
  }
}

/**
 * Delete PDF from R2 storage
 */
export async function deleteFromR2(r2Bucket: R2Bucket, key: string): Promise<void> {
  try {
    await r2Bucket.delete(key);
  } catch (error) {
    console.error('R2 deletion failed:', error);
    throw new Error('Failed to delete PDF from storage');
  }
}

/**
 * List PDFs in R2 storage
 */
export async function listR2Objects(
  r2Bucket: R2Bucket,
  prefix?: string,
  limit?: number
): Promise<R2Objects> {
  try {
    return await r2Bucket.list({
      prefix: prefix || '',
      limit: limit || 1000,
    });
  } catch (error) {
    console.error('R2 list failed:', error);
    throw new Error('Failed to list PDFs from storage');
  }
}
