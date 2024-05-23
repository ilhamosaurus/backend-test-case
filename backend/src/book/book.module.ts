import { Module } from '@nestjs/common';
import { BookService } from './book.service';
import { BookController } from './book.controller';
import { UserService } from 'src/user/user.service';

@Module({
  controllers: [BookController],
  providers: [BookService, UserService],
})
export class BookModule {}
