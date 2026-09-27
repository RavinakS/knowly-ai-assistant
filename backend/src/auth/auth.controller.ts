import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthenticatedUser } from './authenticated-user.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const AUTH_COOKIE = 'knowly_session';
const COOKIE_MAX_AGE = 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setAuthCookie(response, result.token);
    return { user: result.user, organization: result.organization };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(response, result.token);
    return { user: result.user, organization: result.organization };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    const sameSite = process.env.COOKIE_SAME_SITE === 'none' ? 'none' : 'lax';
    response.clearCookie(AUTH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
      sameSite,
      path: '/',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getAccount(user.id);
  }

  private setAuthCookie(response: Response, token: string): void {
    const sameSite = process.env.COOKIE_SAME_SITE === 'none' ? 'none' : 'lax';
    response.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
      sameSite,
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
  }
}
