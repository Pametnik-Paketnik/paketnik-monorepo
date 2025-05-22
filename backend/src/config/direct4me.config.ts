import { ConfigService } from '@nestjs/config';

export const getDirect4meConfig = (configService: ConfigService) => ({
  apiKey: configService.get<string>('DIRECT4ME_TOKEN'),
  baseUrl: configService.get<string>('DIRECT4ME_BASEURL'),
});
