import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoxesService } from './boxes.service';
import { BoxesController } from './boxes.controller';
import { Box } from './entities/box.entity';
import { BoxImage } from './entities/box-image.entity';
import { BoxImagesService } from './services/box-images.service';
import { BoxImagesController } from './controllers/box-images.controller';
import { PublicBoxImagesController } from './controllers/public-box-images.controller';
import { StorageModule } from '../storage/storage.module';
import { HttpModule } from '@nestjs/axios';
import { UnlockHistory } from './entities/unlock-history.entity';
import { UsersModule } from '../users/users.module';
import { Reservation } from '../reservations/entities/reservation.entity';

@Module({
  imports: [
    UsersModule,
    StorageModule,
    TypeOrmModule.forFeature([Box, BoxImage, UnlockHistory, Reservation]),
    HttpModule,
  ],
  controllers: [
    BoxesController,
    BoxImagesController,
    PublicBoxImagesController,
  ],
  providers: [BoxesService, BoxImagesService],
  exports: [BoxesService, BoxImagesService],
})
export class BoxesModule {}
