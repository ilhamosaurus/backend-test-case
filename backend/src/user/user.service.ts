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

  async getAllUsers() {
    try {
      const users = await this.prisma.user.findMany({
        include: {
          BooksOnUser: {
            select: {
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
      });

      if (!users) {
        throw new NotFoundException('No users found');
      }

      return users;
    } catch (error) {
      Logger.error(error);
      throw new InternalServerErrorException(`Failed to get users: ${error}`);
    }
  }

  async penalizeUser(code: string) {
    const now = Date.now();
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const returnedBooks = await tx.booksOnUser.updateMany({
          where: {
            user_code: code,
            returned: false,
          },
          data: {
            returned: true,
          },
        });
        if (!Array.isArray(returnedBooks) || returnedBooks.count === 0) {
          throw new NotFoundException('No users found');
        }

        await tx.book.updateMany({
          where: {
            code: {
              in: Array.isArray(returnedBooks)
                ? returnedBooks.map((book) => book.book_code)
                : [],
            },
          },
          data: {
            stock: {
              increment: 1,
            },
          },
        });

        return tx.user.update({
          where: {
            code,
          },
          data: {
            penalty: new Date(now),
          },
        });
      });

      return { message: 'User penalized successfully', data: user };
    } catch (error) {
      Logger.error(error);
      throw new InternalServerErrorException(
        `Failed to penalize user: ${error}`,
      );
    }
  }
}
