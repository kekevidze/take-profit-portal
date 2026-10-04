/**
 * qrCode.js
 * Generates and renders a QR code for deposit session sharing.
 */

export class QrCode {
  /**
   * Generates a beautiful HTML container with a QR code image representing the given URL.
   */
  static renderHTML(url, size = 180) {
    if (!url) return '';
    const encodedUrl = encodeURIComponent(url);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}&margin=10&color=0f172a&bgcolor=ffffff`;

    return `
      <div class="flex-col align-center gap-md text-center" style="padding: var(--spacing-md) 0;">
        <div style="background-color: #ffffff; padding: var(--spacing-sm); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); display: inline-flex; justify-content: center; align-items: center; border: 1px solid var(--border-strong);">
          <img src="${qrApiUrl}" alt="Scan QR Code" style="width: ${size}px; height: ${size}px; border-radius: var(--radius-sm);" />
        </div>
        <p style="font-size: 0.8rem; color: var(--text-tertiary); max-width: 240px; margin: 0 auto;">
          Have your client scan this QR code with their mobile device to open the deposit page instantly.
        </p>
      </div>
    `;
  }
}

export default QrCode;
