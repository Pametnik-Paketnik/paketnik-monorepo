import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBoxDto {
  @ApiProperty({
    description: 'The unique identifier of the box',
    example: 'BOX123',
  })
  @IsString()
  @IsNotEmpty()
  boxId: string;

  @ApiProperty({
    description: 'The location of the box',
    example: 'Building A, Floor 1',
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    description: 'The ID of the host who owns this box',
    example: 123,
  })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  ownerId: number;

  @ApiProperty({
    description: 'The status of the box',
    enum: ['FREE', 'BUSY'],
    default: 'FREE',
    example: 'FREE',
  })
  @IsEnum(['FREE', 'BUSY'])
  @IsOptional()
  status?: 'FREE' | 'BUSY';
}
