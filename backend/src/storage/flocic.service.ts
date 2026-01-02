import { Injectable, Logger } from '@nestjs/common';
import * as sharpImport from 'sharp';

// Handle both ESM and CommonJS module systems
const sharpWithDefault = sharpImport as unknown as {
  default?: typeof sharpImport;
};
const sharp: typeof sharpImport =
  typeof sharpWithDefault.default === 'function'
    ? sharpWithDefault.default
    : sharpImport;

@Injectable()
export class FlocicService {
  private readonly logger = new Logger(FlocicService.name);

  /**
   * Compress RGB image using FLoCIC algorithm
   * Processes R, G, B channels separately
   */
  async compressImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Convert any format to raw RGB using sharp
      // Explicitly convert to sRGB first to ensure consistent color space
      const result = await sharp(imageBuffer)
        .toColorspace('srgb') // Normalize to sRGB color space
        .removeAlpha() // Remove alpha channel if present
        .raw()
        .toBuffer({ resolveWithObject: true });

      const width: number = result.info.width;
      const height: number = result.info.height;
      const channels: number = result.info.channels; // Should be 3 for RGB

      // Extract R, G, B channels
      const rChannel = this.extractChannel(
        result.data,
        width,
        height,
        0,
        channels,
      );
      const gChannel = this.extractChannel(
        result.data,
        width,
        height,
        1,
        channels,
      );
      const bChannel = this.extractChannel(
        result.data,
        width,
        height,
        2,
        channels,
      );

      // Compress each channel separately
      const compressedR = this.compressChannel(rChannel, width, height);
      const compressedG = this.compressChannel(gChannel, width, height);
      const compressedB = this.compressChannel(bChannel, width, height);

      // Combine compressed channels into single buffer
      return this.combineCompressedChannels(
        compressedR,
        compressedG,
        compressedB,
        width,
        height,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('FLoCIC compression failed', error);
      throw new Error(`FLoCIC compression failed: ${errorMessage}`);
    }
  }

  /**
   * Decompress FLoCIC compressed image back to RGB
   */
  async decompressImage(compressedBuffer: Buffer): Promise<Buffer> {
    try {
      // Split compressed buffer into R, G, B channels
      const { rChannel, gChannel, bChannel, width, height } =
        this.splitCompressedChannels(compressedBuffer);

      // Decompress each channel
      const decompressedR = this.decompressChannel(rChannel, width);
      const decompressedG = this.decompressChannel(gChannel, width);
      const decompressedB = this.decompressChannel(bChannel, width);

      // Combine channels back to RGB
      const rgbBuffer = this.combineRGBChannels(
        decompressedR,
        decompressedG,
        decompressedB,
        width,
        height,
      );

      // Convert raw RGB to JPEG using sharp
      // Explicitly set color space to sRGB to ensure correct color interpretation
      const outputBuffer: Buffer = await sharp(rgbBuffer, {
        raw: {
          width,
          height,
          channels: 3,
        },
      })
        .toColorspace('srgb') // Ensure sRGB color space
        .jpeg({ quality: 95 })
        .toBuffer();
      return outputBuffer;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('FLoCIC decompression failed', error);
      throw new Error(`FLoCIC decompression failed: ${errorMessage}`);
    }
  }

  // ========== Helper Methods ==========

  /**
   * Extract single channel (R, G, or B) from RGB buffer
   */
  private extractChannel(
    rgbData: Buffer,
    width: number,
    height: number,
    channelIndex: number,
    totalChannels: number,
  ): number[] {
    const pixels: number[] = [];
    for (let i = 0; i < rgbData.length; i += totalChannels) {
      pixels.push(rgbData[i + channelIndex]);
    }
    return pixels;
  }

  /**
   * Compress single grayscale channel using FLoCIC
   */
  private compressChannel(
    pixels: number[],
    width: number,
    height: number,
  ): Buffer {
    const n = width * height;

    // Step 1: Calculate prediction errors (E)
    const E: number[] = Array.from({ length: n }, (_, i) =>
      i === 0 ? pixels[0] : 0,
    );
    for (let i = 1; i < n; i++) {
      const y = Math.floor(i / width);
      const x = i % width;
      const pred = this.predictValue(pixels, x, y, width);
      E[i] = pred - pixels[i];
    }

    // Step 2: Map errors to non-negative values (N)
    const N: number[] = Array.from({ length: n }, () => 0);
    for (let i = 0; i < n; i++) {
      if (E[i] >= 0) {
        N[i] = 2 * E[i];
      } else {
        N[i] = 2 * Math.abs(E[i]) - 1;
      }
    }

    // Step 3: Calculate cumulative values (C)
    const C: number[] = Array.from({ length: n }, (_, i) =>
      i === 0 ? N[0] : 0,
    );
    for (let i = 1; i < n; i++) {
      C[i] = C[i - 1] + N[i];
    }

    // Step 4: Recursive encoding (IC)
    const bitWriter = new BitWriter();
    bitWriter.writeValue(height, 16);
    bitWriter.writeValue(pixels[0], 8); // Store original first pixel (0-255), NOT C[0]
    bitWriter.writeValue(C[n - 1], 32);
    bitWriter.writeValue(n, 32);

    this.IC(bitWriter, C, 0, n - 1);
    bitWriter.flush();

    return Buffer.from(bitWriter.data);
  }

  /**
   * Decompress single channel
   */
  private decompressChannel(compressedData: Buffer, width: number): number[] {
    const bitReader = new BitReader(compressedData);
    bitReader.readValue(16); // Read height (not used, but needed for format)
    const firstPixel = bitReader.readValue(8); // Original first pixel value (0-255)
    const cn_1 = bitReader.readValue(32);
    const n = bitReader.readValue(32);

    // Calculate C[0] from firstPixel: C[0] = N[0] = 2 * firstPixel
    const c0 = 2 * firstPixel;

    // Reconstruct cumulative array (C)
    const C: number[] = Array.from({ length: n }, (_, i) => {
      if (i === 0) return c0;
      if (i === n - 1) return cn_1;
      return 0;
    });

    this.DeIC(bitReader, C, 0, n - 1);

    // Reconstruct N from C
    const N: number[] = Array.from({ length: n }, (_, i) =>
      i === 0 ? C[0] : 0,
    );
    for (let i = 1; i < n; i++) {
      N[i] = C[i] - C[i - 1];
    }

    // Reconstruct E from N
    const E: number[] = Array.from({ length: n }, () => 0);
    for (let i = 0; i < n; i++) {
      if (N[i] % 2 === 0) {
        E[i] = N[i] / 2;
      } else {
        E[i] = -((N[i] + 1) / 2);
      }
    }

    // Reconstruct pixels (P) from errors
    // First pixel is stored directly, not as an error
    const P: number[] = Array.from({ length: n }, (_, i) =>
      i === 0 ? firstPixel : 0,
    );
    for (let i = 1; i < n; i++) {
      const y = Math.floor(i / width);
      const x = i % width;
      const pred = this.predictValue(P, x, y, width);
      P[i] = pred - E[i];
    }

    return P;
  }

  /**
   * Predict pixel value using neighbors (JPEG-LS predictor)
   */
  private predictValue(
    pixels: number[],
    x: number,
    y: number,
    width: number,
  ): number {
    if (y === 0 && x === 0) return 0;
    if (y === 0) return pixels[y * width + (x - 1)];
    if (x === 0) return pixels[(y - 1) * width + x];

    const a = pixels[y * width + (x - 1)]; // Left
    const b = pixels[(y - 1) * width + x]; // Top
    const c = pixels[(y - 1) * width + (x - 1)]; // Top-left

    if (c >= Math.max(a, b)) return Math.min(a, b);
    if (c <= Math.min(a, b)) return Math.max(a, b);
    return a + b - c;
  }

  /**
   * Recursive encoding (IC - Interpolative Coding)
   */
  private IC(bitWriter: BitWriter, C: number[], L: number, H: number): void {
    if (H - L > 1) {
      if (C[H] !== C[L]) {
        const m = Math.floor((H + L) / 2);
        const diff = C[H] - C[L];
        const g = diff > 0 ? Math.ceil(Math.log2(diff + 1)) : 0;
        bitWriter.writeValue(C[m] - C[L], g);
        if (L < m) this.IC(bitWriter, C, L, m);
        if (m < H) this.IC(bitWriter, C, m, H);
      }
    }
  }

  /**
   * Recursive decoding (DeIC)
   */
  private DeIC(bitReader: BitReader, C: number[], L: number, H: number): void {
    if (H - L > 1) {
      if (C[H] === C[L]) {
        // Fill with same value
        for (let i = L + 1; i < H; i++) {
          C[i] = C[L];
        }
      } else {
        const m = Math.floor((H + L) / 2);
        const diff = C[H] - C[L];
        const g = diff > 0 ? Math.ceil(Math.log2(diff + 1)) : 0;
        const val = bitReader.readValue(g);
        C[m] = C[L] + val;
        if (L < m) this.DeIC(bitReader, C, L, m);
        if (m < H) this.DeIC(bitReader, C, m, H);
      }
    }
  }

  /**
   * Combine compressed R, G, B channels into single buffer
   * Format: [width(4B)][height(4B)][format(1B)][R_size(4B)][R_data][G_size(4B)][G_data][B_size(4B)][B_data]
   */
  private combineCompressedChannels(
    rCompressed: Buffer,
    gCompressed: Buffer,
    bCompressed: Buffer,
    width: number,
    height: number,
  ): Buffer {
    const rSize = Buffer.allocUnsafe(4);
    rSize.writeUInt32BE(rCompressed.length, 0);

    const gSize = Buffer.allocUnsafe(4);
    gSize.writeUInt32BE(gCompressed.length, 0);

    const bSize = Buffer.allocUnsafe(4);
    bSize.writeUInt32BE(bCompressed.length, 0);

    // Metadata: width(4B) + height(4B) + format(1B) = 9 bytes
    const metadata = Buffer.allocUnsafe(9);
    metadata.writeUInt32BE(width, 0);
    metadata.writeUInt32BE(height, 4);
    metadata.writeUInt8(0x01, 8); // Format version

    return Buffer.concat([
      metadata,
      rSize,
      rCompressed,
      gSize,
      gCompressed,
      bSize,
      bCompressed,
    ]);
  }

  /**
   * Split compressed buffer back into R, G, B channels
   */
  private splitCompressedChannels(compressedBuffer: Buffer): {
    rChannel: Buffer;
    gChannel: Buffer;
    bChannel: Buffer;
    width: number;
    height: number;
  } {
    let offset = 0;

    // Read metadata
    const width = compressedBuffer.readUInt32BE(offset);
    offset += 4;
    const height = compressedBuffer.readUInt32BE(offset);
    offset += 4;
    compressedBuffer.readUInt8(offset); // Read format version (not used)
    offset += 1;

    // Read R channel
    const rSize = compressedBuffer.readUInt32BE(offset);
    offset += 4;
    const rChannel = compressedBuffer.subarray(offset, offset + rSize);
    offset += rSize;

    // Read G channel
    const gSize = compressedBuffer.readUInt32BE(offset);
    offset += 4;
    const gChannel = compressedBuffer.subarray(offset, offset + gSize);
    offset += gSize;

    // Read B channel
    const bSize = compressedBuffer.readUInt32BE(offset);
    offset += 4;
    const bChannel = compressedBuffer.subarray(offset, offset + bSize);

    return { rChannel, gChannel, bChannel, width, height };
  }

  /**
   * Combine R, G, B channels into RGB buffer
   */
  private combineRGBChannels(
    r: number[],
    g: number[],
    b: number[],
    width: number,
    height: number,
  ): Buffer {
    const buffer = Buffer.allocUnsafe(width * height * 3);
    for (let i = 0; i < r.length; i++) {
      const idx = i * 3;
      // Ensure values are clamped to valid byte range and rounded
      const rVal = Math.max(0, Math.min(255, Math.round(r[i])));
      const gVal = Math.max(0, Math.min(255, Math.round(g[i])));
      const bVal = Math.max(0, Math.min(255, Math.round(b[i])));

      buffer[idx] = rVal; // R
      buffer[idx + 1] = gVal; // G
      buffer[idx + 2] = bVal; // B
    }
    return buffer;
  }
}

// ========== BitWriter Class ==========
class BitWriter {
  data: number[] = [];
  private currentByte = 0;
  private bitCount = 0;

  writeBit(bit: number): void {
    if (bit) this.currentByte |= 1 << (7 - this.bitCount);
    this.bitCount++;
    if (this.bitCount === 8) {
      this.data.push(this.currentByte);
      this.currentByte = 0;
      this.bitCount = 0;
    }
  }

  writeValue(value: number, numBits: number): void {
    for (let i = numBits - 1; i >= 0; i--) {
      this.writeBit((value >> i) & 1);
    }
  }

  flush(): void {
    if (this.bitCount > 0) {
      this.data.push(this.currentByte);
      this.currentByte = 0;
      this.bitCount = 0;
    }
  }
}

// ========== BitReader Class ==========
class BitReader {
  private data: Buffer;
  private byteIndex = 0;
  private bitIndex = 0;

  constructor(data: Buffer) {
    this.data = data;
  }

  readBit(): number {
    if (this.byteIndex >= this.data.length) return 0;
    const bit = (this.data[this.byteIndex] >> (7 - this.bitIndex)) & 1;
    this.bitIndex++;
    if (this.bitIndex === 8) {
      this.bitIndex = 0;
      this.byteIndex++;
    }
    return bit;
  }

  readValue(numBits: number): number {
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      value = (value << 1) | this.readBit();
    }
    return value;
  }
}
