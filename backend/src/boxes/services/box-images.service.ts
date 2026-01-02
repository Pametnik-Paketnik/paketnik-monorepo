import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoxImage } from '../entities/box-image.entity';
import { Box } from '../entities/box.entity';
import { StorageService } from '../../storage/storage.service';
import { MulterFile } from '../../common/interfaces/multer.interface';

@Injectable()
export class BoxImagesService {
  constructor(
    @InjectRepository(BoxImage)
    private boxImageRepository: Repository<BoxImage>,
    @InjectRepository(Box)
    private boxRepository: Repository<Box>,
    private storageService: StorageService,
    private configService: ConfigService,
  ) {}

  async uploadImage(
    boxId: string,
    file: MulterFile,
    isPrimary: boolean = false,
  ): Promise<BoxImage> {
    // Check if box exists
    const box = await this.boxRepository.findOne({ where: { boxId } });
    if (!box) {
      throw new NotFoundException(`Box with ID ${boxId} not found`);
    }

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 10MB');
    }

    try {
      // Upload to MinIO using storage service (now compresses with FLoCIC)
      const { key } = await this.storageService.uploadBoxImage(file, boxId);

      // If this image is set as primary, unset other primary images for this box
      if (isPrimary) {
        await this.boxImageRepository.update(
          { box: { id: box.id } },
          { isPrimary: false },
        );
      }

      // Save image metadata to database (temporarily without imageUrl)
      const boxImage = this.boxImageRepository.create({
        imageKey: key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        imageUrl: '', // Will be set after save
        isPrimary,
        box,
      });

      const savedImage = await this.boxImageRepository.save(boxImage);

      // Generate backend URL for serving the image
      const apiBaseUrl =
        this.configService.get<string>('API_BASE_URL') ||
        this.configService.get<string>('BASE_URL') ||
        'http://localhost:3000';

      // Ensure URL has proper format (fix missing colon issue)
      const baseUrl =
        apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')
          ? apiBaseUrl
          : `http://${apiBaseUrl}`;

      // Use public endpoint (no auth required for displaying images)
      savedImage.imageUrl = `${baseUrl}/api/public/boxes/${boxId}/images/${savedImage.id}/file`;

      return await this.boxImageRepository.save(savedImage);
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message || 'Unknown error';
      throw new BadRequestException(`Failed to upload image: ${errorMessage}`);
    }
  }

  async deleteImage(imageId: number): Promise<void> {
    const boxImage = await this.boxImageRepository.findOne({
      where: { id: imageId },
    });

    if (!boxImage) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    try {
      // Delete from MinIO
      await this.storageService.deleteFile('images', boxImage.imageKey);

      // Delete from database
      await this.boxImageRepository.remove(boxImage);
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message || 'Unknown error';
      throw new BadRequestException(`Failed to delete image: ${errorMessage}`);
    }
  }

  async getBoxImages(boxId: string): Promise<BoxImage[]> {
    const box = await this.boxRepository.findOne({ where: { boxId } });
    if (!box) {
      throw new NotFoundException(`Box with ID ${boxId} not found`);
    }

    return await this.boxImageRepository.find({
      where: { box: { id: box.id } },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async setPrimaryImage(imageId: number): Promise<BoxImage> {
    const boxImage = await this.boxImageRepository.findOne({
      where: { id: imageId },
      relations: ['box'],
    });

    if (!boxImage) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    // Unset other primary images for this box
    await this.boxImageRepository.update(
      { box: { id: boxImage.box.id } },
      { isPrimary: false },
    );

    // Set this image as primary
    boxImage.isPrimary = true;
    return await this.boxImageRepository.save(boxImage);
  }

  async getImageById(imageId: number): Promise<BoxImage> {
    const boxImage = await this.boxImageRepository.findOne({
      where: { id: imageId },
    });

    if (!boxImage) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    return boxImage;
  }
}
