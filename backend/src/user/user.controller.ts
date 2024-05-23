import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { createDto } from './dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getAllUsers(
    @Query() query: { pageSize?: number; pageNumber?: number },
  ) {
    return this.userService.getAllUsers(query.pageNumber, query.pageSize);
  }

  @Post()
  async createUser(@Body() dto: createDto) {
    return this.userService.createUser(dto);
  }

  @Patch('penalize/:code')
  async penalizeUser(@Param('code') code: string) {
    return this.userService.penalizeUser(code);
  }
}
