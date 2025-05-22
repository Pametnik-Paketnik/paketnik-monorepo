import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OpenBoxDto {
  @ApiProperty({ description: 'ID of the box to open', example: 530 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  boxId: number;

  @ApiProperty({
    description: 'Token format (0-6)',
    example: 3,
    enum: [0, 1, 2, 3, 4, 5, 6],
  })
  @IsInt()
  @Min(0)
  @Max(6)
  tokenFormat: number;
}
