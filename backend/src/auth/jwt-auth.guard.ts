import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

const AUTH_COOKIE = 'knowly_session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException();
    }

    let payload: { sub?: unknown };
    try {
      payload = await this.jwtService.verifyAsync<{ sub?: unknown }>(token);
    } catch (error) {
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
          error.name,
        )
      ) {
        throw new UnauthorizedException();
      }
      throw error;
    }

    if (typeof payload.sub !== 'string' || !isUUID(payload.sub)) {
      throw new UnauthorizedException();
    }

    request.user = { id: payload.sub };
    return true;
  }
}
