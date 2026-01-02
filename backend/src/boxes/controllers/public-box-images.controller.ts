import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BoxImagesService } from '../services/box-images.service';
import { StorageService } from '../../storage/storage.service';
import { FlocicService } from '../../storage/flocic.service';

@ApiTags('Public Box Images')
@Controller('public/boxes/:boxId/images')
export class PublicBoxImagesController {
  constructor(
    private readonly boxImagesService: BoxImagesService,
    private readonly storageService: StorageService,
    private readonly flocicService: FlocicService,
  ) {}

  @Get(':imageId/file')
  @ApiOperation({ summary: 'Get image file (public, no auth required)' })
  @ApiParam({ name: 'boxId', description: 'Box ID' })
  @ApiParam({ name: 'imageId', description: 'Image ID' })
  async getImageFile(
    @Param('boxId') boxId: string,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Res() res: Response,
  ): Promise<void> {
    const boxImage = await this.boxImagesService.getImageById(imageId);

    // Get file from MinIO
    const compressedBuffer = await this.storageService.getFile(
      'images',
      boxImage.imageKey,
    );

    // Check if file is FLoCIC compressed (by extension)
    const isCompressed = boxImage.imageKey.endsWith('.flc');

    let imageBuffer: Buffer;
    let contentType: string;

    if (isCompressed) {
      // Decompress FLoCIC
      imageBuffer = await this.flocicService.decompressImage(compressedBuffer);
      // Use original mime type from database
      contentType = boxImage.mimeType;
    } else {
      // Not compressed, serve as-is
      imageBuffer = compressedBuffer;
      contentType = boxImage.mimeType;
    }

    // Set headers and send
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.send(imageBuffer);
  }
}
