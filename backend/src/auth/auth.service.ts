import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface AuthAccount {
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  };
}

export interface AuthResult extends AuthAccount {
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    if (Buffer.byteLength(dto.password, "utf8") > 72) {
      throw new BadRequestException("Password must not exceed 72 UTF-8 bytes.");
    }
    const passwordHash = await hash(dto.password, 12);

    try {
      const account = await this.prisma.$transaction(async (transaction) => {
        const organization = await transaction.organization.create({
          data: { name: dto.organizationName },
          select: { id: true, name: true },
        });
        const user = await transaction.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            organizationId: organization.id,
          },
          select: { id: true, email: true, name: true },
        });
        await transaction.assistant.create({
          data: {
            organizationId: organization.id,
            token: randomBytes(32).toString("base64url"),
          },
        });

        return { user, organization };
      });

      return { ...account, token: await this.createToken(account.user.id) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = error.meta?.target;
        if (
          (Array.isArray(target) && target.includes("email")) ||
          (typeof target === "string" && target.includes("email"))
        ) {
          throw new ConflictException(
            "An account with this email already exists.",
          );
        }
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    if (Buffer.byteLength(dto.password, "utf8") > 72) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        organization: { select: { id: true, name: true } },
      },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: user.organization,
      token: await this.createToken(user.id),
    };
  }

  async getAccount(userId: string): Promise<AuthAccount> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        organization: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: user.organization,
    };
  }

  private createToken(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId });
  }
}
