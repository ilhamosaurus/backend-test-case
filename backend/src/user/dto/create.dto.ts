import { IsNotEmpty, IsString } from 'class-validator';

export class createDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
