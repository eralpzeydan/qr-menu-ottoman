declare module 'qrcode' {
  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  interface QRCodeOptions {
    width?: number;
    errorCorrectionLevel?: ErrorCorrectionLevel;
    type?: string;
  }

  interface QRCodeModule {
    toBuffer(text: string, options?: QRCodeOptions): Promise<Buffer>;
    toString(text: string, options?: QRCodeOptions): Promise<string>;
  }

  const qrCode: QRCodeModule;
  export = qrCode;
}
