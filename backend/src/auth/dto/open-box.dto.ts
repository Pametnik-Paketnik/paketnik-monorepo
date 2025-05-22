import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OpenBoxDto {
  @ApiProperty({ description: 'ID of the box to open', example: 352 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  boxId: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  tokenFormat?: number;
}
