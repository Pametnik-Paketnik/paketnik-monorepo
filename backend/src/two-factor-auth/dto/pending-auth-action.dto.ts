import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class PendingAuthActionDto {
  @ApiProperty({
    description: 'UUID of the pending authentication request',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  pendingAuthId: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed',
  })
  message: string;
} 