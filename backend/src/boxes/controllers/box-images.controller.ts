import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Query,
  UseGuards,
  ParseBoolPipe,
  BadRequestException,
  Put,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BoxImagesService } from '../services/box-images.service';
import { BoxImage } from '../entities/box-image.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MulterFile } from '../../common/interfaces/multer.interface';
import { StorageService } from '../../storage/storage.service';
import { FlocicService } from '../../storage/flocic.service';

@ApiTags('Box Images')
@ApiBearerAuth('access-token')
@Controller('boxes/:boxId/images')
@UseGuards(JwtAuthGuard)
export class BoxImagesController {
  constructor(
    private readonly boxImagesService: BoxImagesService,
    private readonly storageService: StorageService,
    private readonly flocicService: FlocicService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload an image for a box' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'boxId', description: 'Box ID' })
  @ApiQuery({
    name: 'isPrimary',
    required: false,
    type: Boolean,
    description: 'Set as primary image',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadImage(
    @Param('boxId') boxId: string,
    @UploadedFile() file: MulterFile,
    @Query('isPrimary', new ParseBoolPipe({ optional: true }))
    isPrimary?: boolean,
  ): Promise<BoxImage> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    return await this.boxImagesService.uploadImage(
      boxId,
      file,
      isPrimary || false,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all images for a box' })
  @ApiParam({ name: 'boxId', description: 'Box ID' })
  async getBoxImages(@Param('boxId') boxId: string): Promise<BoxImage[]> {
    return await this.boxImagesService.getBoxImages(boxId);
  }

  @Delete(':imageId')
  @ApiOperation({ summary: 'Delete a box image' })
  @ApiParam({ name: 'boxId', description: 'Box ID' })
  @ApiParam({ name: 'imageId', description: 'Image ID' })
  async deleteImage(
    @Param('boxId') boxId: string,
    @Param('imageId', ParseIntPipe) imageId: number,
  ): Promise<{ message: string }> {
    await this.boxImagesService.deleteImage(imageId);
    return { message: 'Image deleted successfully' };
  }

  @Put(':imageId/primary')
  @ApiOperation({ summary: 'Set an image as primary for the box' })
  @ApiParam({ name: 'boxId', description: 'Box ID' })
  @ApiParam({ name: 'imageId', description: 'Image ID' })
  async setPrimaryImage(
    @Param('boxId') boxId: string,
    @Param('imageId', ParseIntPipe) imageId: number,
  ): Promise<BoxImage> {
    return await this.boxImagesService.setPrimaryImage(imageId);
  }

  @Get(':imageId')
  @ApiOperation({ summary: 'Get a specific image details' })
  @ApiParam({ name: 'boxId', description: 'Box ID' })
  @ApiParam({ name: 'imageId', description: 'Image ID' })
  async getImageById(
    @Param('boxId') boxId: string,
    @Param('imageId', ParseIntPipe) imageId: number,
  ): Promise<BoxImage> {
    return await this.boxImagesService.getImageById(imageId);
  }

  @Get(':imageId/file')
  @ApiOperation({ summary: 'Get image file (decompressed if needed)' })
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
