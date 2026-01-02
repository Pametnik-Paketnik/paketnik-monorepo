import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { FlocicService } from './flocic.service';

@Module({
  providers: [StorageService, FlocicService],
  exports: [StorageService, FlocicService],
})
export class StorageModule {}
