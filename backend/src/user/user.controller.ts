import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { createDto } from './dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getAllUsers() {
    return this.userService.getAllUsers();
  }

  @Post()
  async createUser(@Body() dto: createDto) {
    return this.userService.createUser(dto);
  }
}
