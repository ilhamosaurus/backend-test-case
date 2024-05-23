import { IsAlphanumeric, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateBook {
  @IsAlphanumeric('en-US', { message: 'Code must be an alphanumeric' })
  @IsNotEmpty({ message: 'Code is required' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Author is required' })
  author: string;

  @IsInt({ message: 'Stock must be a valid number' })
  @IsNotEmpty({ message: 'Stock is required' })
  stock: number;
}
