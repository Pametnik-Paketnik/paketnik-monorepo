import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getDirect4meConfig } from '../../config/direct4me.config';
import { OpenBoxDto } from '../dto/open-box.dto';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnlockHistory } from '../entities/unlock-history.entity';
import { User } from '../../users/entities/user.entity';

interface OpenBoxResponse {
  data: string;
  result: number;
  errorNumber: number;
  message?: string;
  validationErrors?: Record<string, string>;
}

@Injectable()
export class Direct4meService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly configTokenFormat: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(UnlockHistory)
    private readonly unlockHistoryRepo: Repository<UnlockHistory>,
  ) {
    const config = getDirect4meConfig(this.configService);
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl ?? '';
    this.configTokenFormat = config.tokenFormat;
  }

  async openBox(
    openBoxDto: OpenBoxDto,
    user: User,
  ): Promise<OpenBoxResponse & { tokenFormat: number }> {
    const usedTokenFormat =
      typeof openBoxDto.tokenFormat === 'number'
        ? openBoxDto.tokenFormat
        : this.configTokenFormat;
    let status = 'failure';
    let errorMessage = '';
    try {
      const response: AxiosResponse<OpenBoxResponse> = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}`,
          {
            boxId: openBoxDto.boxId,
            tokenFormat: usedTokenFormat,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (!response || !response.data) {
        throw new HttpException(
          'No response from Direct4me API',
          HttpStatus.BAD_GATEWAY,
        );
      }
      status = response.data.result === 0 ? 'success' : 'failure';
      return { ...response.data, tokenFormat: usedTokenFormat };
    } catch (error: unknown) {
      function hasStringMessage(obj: unknown): obj is { message: string } {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          'message' in obj &&
          typeof (obj as { message?: unknown }).message === 'string'
        );
      }
      if (typeof error === 'object' && error !== null) {
        type ErrorWithResponse = { response?: { data?: { message?: string } } };
        const errWithResponse = error as ErrorWithResponse;
        if (errWithResponse.response?.data?.message) {
          errorMessage = errWithResponse.response.data.message;
        } else if (hasStringMessage(error)) {
          errorMessage = (error as { message: string }).message;
        }
      }
      throw new HttpException(
        `Failed to open box: ${errorMessage || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      // Always log the unlock attempt
      await this.unlockHistoryRepo.save({
        user,
        boxId: String(openBoxDto.boxId),
        status,
        tokenFormat: usedTokenFormat,
      });
    }
  }
}
