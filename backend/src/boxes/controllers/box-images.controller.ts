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
} from '@nestjs/common';
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

@ApiTags('Box Images')
@ApiBearerAuth('access-token')
@Controller('api/boxes/:boxId/images')
@UseGuards(JwtAuthGuard)
export class BoxImagesController {
  constructor(private readonly boxImagesService: BoxImagesService) {}

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
    @UploadedFile() file: any,
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
}
