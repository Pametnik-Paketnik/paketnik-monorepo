import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { CreateCleanerDto } from './dto/create-cleaner.dto';
import { UpdateCleanerDto } from './dto/update-cleaner.dto';

@Injectable()
export class CleanersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createCleaner(
    hostId: number,
    createCleanerDto: CreateCleanerDto,
  ): Promise<User> {
    // Verify the user is a host
    const host = await this.usersRepository.findOne({
      where: { id: hostId, userType: UserType.HOST },
    });

    if (!host) {
      throw new ForbiddenException('Only hosts can create cleaner accounts');
    }

    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: createCleanerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Create the cleaner with plain password
    const cleaner = this.usersRepository.create({
      name: createCleanerDto.name,
      surname: createCleanerDto.surname,
      email: createCleanerDto.email,
      password: createCleanerDto.password,
      userType: UserType.CLEANER,
      host,
    });

    return this.usersRepository.save(cleaner);
  }

  async getCleanersForHost(hostId: number): Promise<User[]> {
    // Verify the user is a host
    const host = await this.usersRepository.findOne({
      where: { id: hostId, userType: UserType.HOST },
    });

    if (!host) {
      throw new ForbiddenException('Only hosts can view their cleaners');
    }

    return this.usersRepository.find({
      where: {
        host: { id: hostId },
        userType: UserType.CLEANER,
      },
      select: [
        'id',
        'name',
        'surname',
        'email',
        'userType',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async getCleanerById(hostId: number, cleanerId: number): Promise<User> {
    const cleaner = await this.usersRepository.findOne({
      where: {
        id: cleanerId,
        userType: UserType.CLEANER,
        host: { id: hostId },
      },
      select: [
        'id',
        'name',
        'surname',
        'email',
        'userType',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!cleaner) {
      throw new NotFoundException('Cleaner not found or not belongs to you');
    }

    return cleaner;
  }

  async updateCleaner(
    hostId: number,
    cleanerId: number,
    updateCleanerDto: UpdateCleanerDto,
  ): Promise<User> {
    const cleaner = await this.getCleanerById(hostId, cleanerId);

    // Check if new email already exists (if provided)
    if (updateCleanerDto.email && updateCleanerDto.email !== cleaner.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateCleanerDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    // Update fields
    if (updateCleanerDto.name) {
      cleaner.name = updateCleanerDto.name;
    }

    if (updateCleanerDto.surname) {
      cleaner.surname = updateCleanerDto.surname;
    }

    if (updateCleanerDto.email) {
      cleaner.email = updateCleanerDto.email;
    }

    if (updateCleanerDto.password) {
      cleaner.password = updateCleanerDto.password;
    }

    return this.usersRepository.save(cleaner);
  }

  async deleteCleaner(hostId: number, cleanerId: number): Promise<void> {
    const cleaner = await this.getCleanerById(hostId, cleanerId);
    await this.usersRepository.remove(cleaner);
  }

  async getHostForCleaner(cleanerId: number): Promise<User | null> {
    const cleaner = await this.usersRepository.findOne({
      where: { id: cleanerId, userType: UserType.CLEANER },
      relations: ['host'],
    });

    return cleaner?.host || null;
  }
}
