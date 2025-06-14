import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return hello message', () => {
    const result = service.getHello();
    expect(result).toContain('Hello');
  });

  it('should pass basic math test', () => {
    expect(2 + 2).toBe(4);
  });

  it('should pass string test', () => {
    expect('Paketnik').toBe('Paketnik');
  });

  it('should pass array test', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
  });
});
