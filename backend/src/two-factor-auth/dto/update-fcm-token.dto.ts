import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class UpdateFcmTokenDto {
  @ApiProperty({
    description: 'FCM token from the mobile device',
    example: 'fGxY8vQnRyuXj9kL2mN3o4P5q6R7s8T9u0V1w2X3y4Z5',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  fcm_token: string;
} 