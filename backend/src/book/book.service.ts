import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { CreateBook } from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class BookService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  async getAllBooks(pageSize?: number, pageNumber?: number) {
    try {
      const books = await this.prisma.book.findMany({
        include: {
          BooksOnUser: true,
        },
        skip: pageSize ? (pageNumber - 1) * pageSize : undefined,
        take: pageSize,
      });

      if (!books || books.length === 0) {
        throw new NotFoundException('No books found');
      }

      return books.map((book) => ({
        code: book.code,
        title: book.title,
        author: book.author,
        stock: book.stock,
        history: book.BooksOnUser.map((bookOnUser) => ({
          user: bookOnUser.user_code,
          isReturned: bookOnUser.returned,
          date: bookOnUser.updatedAt,
        })),
      }));
    } catch (error) {
      Logger.error(error);
      throw new InternalServerErrorException(`Failed to get books: ${error}`);
    }
  }

  async createBook(dto: CreateBook) {
    try {
      const book = await this.prisma.book.create({
        data: {
          code: dto.code,
          title: dto.title,
          author: dto.author,
          stock: dto.stock,
        },
      });
      return { message: 'Book created successfully', data: book };
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ForbiddenException(
          `Book with code ${dto.code} already exists`,
        );
      }
      Logger.error(error);
      throw new InternalServerErrorException(`Failed to create book: ${error}`);
    }
  }
}
