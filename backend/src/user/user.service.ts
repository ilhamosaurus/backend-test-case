import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createDto } from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Book } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(dto: createDto) {
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const number = await tx.user.count();
        const code = 'M' + String(number + 1).padStart(3, '0');
        return tx.user.create({
          data: {
            name: dto.name,
            code,
          },
        });
      });
      return { message: 'User created successfully', data: user };
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ForbiddenException(
          'Code already exists, please try again in a few minutes',
        );
      }
      Logger.error(error);
      throw new InternalServerErrorException(`Failed to create user: ${error}`);
    }
  }

  async getUserDetails(code: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        code,
      },
      include: {
        BooksOnUser: {
          include: {
            book: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Check user availability to borrow book
   * @param code member code
   * @returns true if user can borrow book, false otherwise
   */
  async getUserAvailability(code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: {
        code,
      },
      select: {
        code: true,
        penalty: true,
        books_rent: true,
      },
    });

    if (
      user?.books_rent < 2 &&
      (user.penalty === undefined || this.daysSince(user.penalty) < 3)
    ) {
      return true;
    }

    const overdueBooks = await this.prisma.booksOnUser.findMany({
      where: {
        user_code: code,
        returned: false,
      },
      select: {
        book_code: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return (
      overdueBooks.length === 0 || this.daysSince(overdueBooks[0].createdAt) > 7
    );
  }

  private daysSince(date: Date): number {
    return Math.ceil(
      (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  async getAllUsers(pageSize?: number, pageNumber?: number) {
    try {
      const users = await this.prisma.user.findMany({
        include: {
          BooksOnUser: {
            include: {
              book: {
                select: {
                  code: true,
                  title: true,
                  author: true,
                },
              },
            },
          },
        },
        skip: pageSize ? (pageNumber - 1) * pageSize : undefined,
        take: pageSize,
      });

      if (!users) {
        throw new NotFoundException('No users found');
      }

      return users.map((user) => ({
        code: user.code,
        name: user.name,
        penalty: user.penalty,
        booksRent: user.books_rent,
        books: user.BooksOnUser.map(({ book }) => ({
          code: book.code,
          title: book.title,
          author: book.author,
        })),
      }));
    } catch (error) {
      Logger.error(error);
      throw new InternalServerErrorException(`Failed to get users: ${error}`);
    }
  }

  async penalizeUser(code: string) {
    const now = Date.now();
    try {
      const user = await this.prisma.user.update({
        where: {
          code,
        },
        data: {
          penalty: new Date(now),
          books_rent: 0,
        },
      });

      return { message: 'User penalized successfully', data: user };
    } catch (error) {
      Logger.error(error);
      throw new InternalServerErrorException(
        `Failed to penalize user: ${error}`,
      );
    }
  }

  async changeUserBooks(code: string, books: Book[]) {
    const qty = books.length;
    try {
      const updatedUser = await this.prisma.$transaction(async (tx) => {
        await tx.booksOnUser.updateMany({
          where: {
            book_code: {
              in: books.map((book) => book.code),
            },
            user_code: code,
            returned: false,
          },
          data: {
            returned: true,
          },
        });

        return tx.user.update({
          where: {
            code,
          },
          data: {
            books_rent: {
              decrement: qty,
            },
          },
        });
      });

      return { data: updatedUser };
    } catch (error) {
      Logger.error(error);
      throw new InternalServerErrorException(
        `Failed to change user's books: ${error}`,
      );
    }
  }
}
