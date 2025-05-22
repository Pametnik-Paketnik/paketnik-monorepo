import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class RegisterDto extends CreateUserDto {
  @ApiProperty({
    description: 'Confirm password must match password',
    example: 'password123',
    minLength: 8,
  })
  confirmPassword: string;
}
