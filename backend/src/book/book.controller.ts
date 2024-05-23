import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BookService } from './book.service';
import { CreateBook } from './dto';

@Controller('book')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  @Get()
  async getAllBooks(
    @Query() query: { pageSize?: number; pageNumber?: number },
  ) {
    return this.bookService.getAllBooks(query.pageSize, query.pageNumber);
  }

  @Post()
  async createBook(@Body() dto: CreateBook) {
    return this.bookService.createBook(dto);
  }
}
