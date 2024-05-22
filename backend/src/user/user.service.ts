import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
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
}
