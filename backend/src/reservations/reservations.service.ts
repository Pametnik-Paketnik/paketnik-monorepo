import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckinReservationDto } from './dto/checkin-reservation.dto';
import { CheckoutReservationDto } from './dto/checkout-reservation.dto';
import { CheckinResponseDto } from './dto/checkin-response.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { Reservation, ReservationStatus } from './entities/reservation.entity';
import { Box } from '../boxes/entities/box.entity';
import { User, UserType } from '../users/entities/user.entity';
import { BoxesService } from '../boxes/boxes.service';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
    @InjectRepository(Box)
    private boxesRepository: Repository<Box>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private boxesService: BoxesService,
    private configService: ConfigService,
  ) {}

  private calculateTotalPrice(
    box: Box,
    checkinAt: Date,
    checkoutAt: Date,
  ): number {
    // Calculate the difference in days, considering only the date part (not time)
    const checkinDate = new Date(
      checkinAt.getFullYear(),
      checkinAt.getMonth(),
      checkinAt.getDate(),
    );
    const checkoutDate = new Date(
      checkoutAt.getFullYear(),
      checkoutAt.getMonth(),
      checkoutAt.getDate(),
    );
    const nights = Math.floor(
      (checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return box.pricePerNight * nights;
  }

  async create(
    createReservationDto: CreateReservationDto,
  ): Promise<Reservation> {
    try {
      // Convert ISO 8601 date strings to Date objects
      const checkinAt = new Date(createReservationDto.checkinAt);
      const checkoutAt = new Date(createReservationDto.checkoutAt);

      // Validate that the dates are valid
      if (isNaN(checkinAt.getTime()) || isNaN(checkoutAt.getTime())) {
        throw new BadRequestException('Invalid date format provided');
      }

      // Validate dates
      if (checkinAt >= checkoutAt) {
        throw new BadRequestException(
          'Check-in date must be before check-out date',
        );
      }

      // Check if box exists
      const box = await this.boxesRepository.findOne({
        where: { boxId: createReservationDto.boxId },
      });
      if (!box) {
        throw new NotFoundException(
          `Box with BoxID ${createReservationDto.boxId} not found`,
        );
      }

      if (!box.pricePerNight) {
        throw new BadRequestException(
          'Box does not have a price per night set',
        );
      }

      const totalPrice = this.calculateTotalPrice(box, checkinAt, checkoutAt);

      // Check if guest exists
      const guest = await this.usersRepository.findOne({
        where: { id: createReservationDto.guestId },
      });
      if (!guest) {
        throw new NotFoundException(
          `Guest with ID ${createReservationDto.guestId} not found`,
        );
      }
      if (guest.userType !== UserType.USER) {
        throw new BadRequestException(
          `User with ID ${createReservationDto.guestId} is not a guest user (USER type)`,
        );
      }

      // Check if host exists
      const host = await this.usersRepository.findOne({
        where: { id: createReservationDto.hostId },
      });
      if (!host) {
        throw new NotFoundException(
          `Host with ID ${createReservationDto.hostId} not found`,
        );
      }
      if (host.userType !== UserType.HOST) {
        throw new BadRequestException(
          `User with ID ${createReservationDto.hostId} is not a host user (HOST type)`,
        );
      }

      // Check for overlapping reservations
      const overlappingReservation = await this.reservationsRepository
        .createQueryBuilder('reservation')
        .where('reservation.box_id = :boxId', {
          boxId: box.id,
        })
        .andWhere('reservation.status != :cancelled', {
          cancelled: 'CANCELLED',
        })
        .andWhere(
          '(reservation.checkinAt <= :checkoutAt AND reservation.checkoutAt >= :checkinAt)',
          {
            checkinAt,
            checkoutAt,
          },
        )
        .getOne();

      if (overlappingReservation) {
        throw new ConflictException(
          'Box is already reserved for this time period',
        );
      }

      const reservation = this.reservationsRepository.create({
        ...createReservationDto,
        checkinAt,
        checkoutAt,
        box,
        guest,
        host,
        status: ReservationStatus.PENDING,
        totalPrice,
      });

      return await this.reservationsRepository.save(reservation);
    } catch (error) {
      console.error('Error creating reservation:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create reservation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findAll(): Promise<Reservation[]> {
    // First, update any past reservations
    await this.updatePastReservations();

    // Then return all reservations
    return this.reservationsRepository.find({
      relations: ['guest', 'host', 'box'],
    });
  }

  async findByGuest(guestId: number): Promise<Reservation[]> {
    // First validate that the user exists and is of USER type
    const guest = await this.usersRepository.findOne({
      where: { id: guestId },
    });
    if (!guest) {
      throw new NotFoundException(`Guest with ID ${guestId} not found`);
    }
    if (guest.userType !== UserType.USER) {
      throw new BadRequestException(
        `User with ID ${guestId} is not a guest user (USER type)`,
      );
    }

    return this.reservationsRepository.find({
      where: { guest: { id: guestId } },
      relations: ['guest', 'host', 'box'],
    });
  }

  async findByHost(hostId: number): Promise<Reservation[]> {
    // First validate that the user exists and is of HOST type
    const host = await this.usersRepository.findOne({
      where: { id: hostId },
    });
    if (!host) {
      throw new NotFoundException(`Host with ID ${hostId} not found`);
    }
    if (host.userType !== UserType.HOST) {
      throw new BadRequestException(
        `User with ID ${hostId} is not a host user (HOST type)`,
      );
    }

    return this.reservationsRepository.find({
      where: { host: { id: hostId } },
      relations: ['guest', 'host', 'box'],
    });
  }

  async findOne(id: number): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
      relations: ['guest', 'host', 'box'],
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation with ID ${id} not found`);
    }

    return reservation;
  }

  async update(
    id: number,
    updateReservationDto: UpdateReservationDto,
  ): Promise<Reservation> {
    const reservation = await this.findOne(id);

    // Convert ISO 8601 date strings to Date objects if provided
    let checkinAt: Date | undefined;
    let checkoutAt: Date | undefined;

    if (updateReservationDto.checkinAt) {
      checkinAt = new Date(updateReservationDto.checkinAt);
      if (isNaN(checkinAt.getTime())) {
        throw new BadRequestException('Invalid check-in date format provided');
      }
    }

    if (updateReservationDto.checkoutAt) {
      checkoutAt = new Date(updateReservationDto.checkoutAt);
      if (isNaN(checkoutAt.getTime())) {
        throw new BadRequestException('Invalid check-out date format provided');
      }
    }

    // If dates are being updated, check for overlapping reservations
    if (updateReservationDto.checkinAt || updateReservationDto.checkoutAt) {
      const finalCheckinAt = checkinAt || reservation.checkinAt;
      const finalCheckoutAt = checkoutAt || reservation.checkoutAt;

      if (finalCheckinAt >= finalCheckoutAt) {
        throw new BadRequestException(
          'Check-in date must be before check-out date',
        );
      }

      const overlappingReservation = await this.reservationsRepository
        .createQueryBuilder('reservation')
        .where('reservation.box_id = :boxId', { boxId: reservation.box.id })
        .andWhere('reservation.id != :id', { id })
        .andWhere('reservation.status != :cancelled', {
          cancelled: 'CANCELLED',
        })
        .andWhere(
          '(reservation.checkinAt <= :checkoutAt AND reservation.checkoutAt >= :checkinAt)',
          {
            checkinAt: finalCheckinAt,
            checkoutAt: finalCheckoutAt,
          },
        )
        .getOne();

      if (overlappingReservation) {
        throw new ConflictException(
          'Box is already reserved for this time period',
        );
      }
    }

    // Update related entities if IDs are provided
    if (updateReservationDto.boxId) {
      const box = await this.boxesRepository.findOne({
        where: { boxId: updateReservationDto.boxId },
      });
      if (!box) {
        throw new NotFoundException(
          `Box with BoxID ${updateReservationDto.boxId} not found`,
        );
      }
      reservation.box = box;
    }

    if (updateReservationDto.guestId) {
      const guest = await this.usersRepository.findOne({
        where: { id: updateReservationDto.guestId },
      });
      if (!guest) {
        throw new NotFoundException(
          `Guest with ID ${updateReservationDto.guestId} not found`,
        );
      }
      if (guest.userType !== UserType.USER) {
        throw new BadRequestException(
          `User with ID ${updateReservationDto.guestId} is not a guest user (USER type)`,
        );
      }
      reservation.guest = guest;
    }

    if (updateReservationDto.hostId) {
      const host = await this.usersRepository.findOne({
        where: { id: updateReservationDto.hostId },
      });
      if (!host) {
        throw new NotFoundException(
          `Host with ID ${updateReservationDto.hostId} not found`,
        );
      }
      if (host.userType !== UserType.HOST) {
        throw new BadRequestException(
          `User with ID ${updateReservationDto.hostId} is not a host user (HOST type)`,
        );
      }
      reservation.host = host;
    }

    // Update other fields, including converted dates
    const updateData = { ...updateReservationDto };
    // Remove the string dates from updateData since we'll assign Date objects directly
    delete updateData.checkinAt;
    delete updateData.checkoutAt;

    Object.assign(reservation, updateData);

    // Assign converted Date objects directly to the reservation entity
    if (checkinAt) reservation.checkinAt = checkinAt;
    if (checkoutAt) reservation.checkoutAt = checkoutAt;

    return this.reservationsRepository.save(reservation);
  }

  async remove(id: number): Promise<void> {
    const reservation = await this.findOne(id);
    await this.reservationsRepository.remove(reservation);
  }

  async checkin(
    checkinDto: CheckinReservationDto,
    jwtUser: { userId: number; username: string },
  ): Promise<CheckinResponseDto> {
    // First, get the full user entity from the database
    const user = await this.usersRepository.findOne({
      where: { id: jwtUser.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${jwtUser.userId} not found`);
    }

    // Find the reservation with relations
    const reservation = await this.reservationsRepository.findOne({
      where: { id: checkinDto.reservationId },
      relations: ['guest', 'host', 'box'],
    });

    if (!reservation) {
      throw new NotFoundException(
        `Reservation with ID ${checkinDto.reservationId} not found`,
      );
    }

    // Validate that the user is the guest of this reservation
    if (reservation.guest.id !== user.id) {
      throw new BadRequestException(
        'You can only check in to your own reservations',
      );
    }

    // Validate that the guest is of USER type
    if (user.userType !== UserType.USER) {
      throw new BadRequestException(
        'Only guest users (USER type) can check in',
      );
    }

    // Validate reservation status
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot check in to reservation with status: ${reservation.status}`,
      );
    }

    // Validate time window (check-in allowed from start of checkinAt date to checkoutAt)
    const now = new Date();
    // Note: Time validation is currently disabled
    // const checkinDate = new Date(reservation.checkinAt);
    // const checkinStart = new Date(
    //   checkinDate.getFullYear(),
    //   checkinDate.getMonth(),
    //   checkinDate.getDate(),
    //   0,
    //   0,
    //   0,
    // ); // Start of day
    // const checkinEnd = new Date(reservation.checkoutAt);

    // if (now < checkinStart || now > checkinEnd) {
    //   throw new BadRequestException(
    //     `Check-in is only allowed between ${checkinStart.toISOString()} and ${checkinEnd.toISOString()}`,
    //   );
    // }

    try {
      // Open the box using BoxesService
      const openBoxResponse = await this.boxesService.openBox(
        {
          boxId: parseInt(reservation.box.boxId), // Convert string boxId to number for Direct4me API
          tokenFormat:
            this.configService.get<number>('DIRECT4ME_TOKEN_FORMAT') ?? 5, // Use DIRECT4ME_TOKEN_FORMAT from environment variables
        },
        user,
      );

      // Update reservation status to CHECKED_IN and record actual check-in time
      reservation.status = ReservationStatus.CHECKED_IN;
      reservation.actualCheckinAt = now;
      await this.reservationsRepository.save(reservation);

      return {
        success: true,
        message: `Successfully checked in to box ${reservation.box.boxId}`,
        reservationId: reservation.id,
        boxId: reservation.box.boxId,
        status: reservation.status,
        data: openBoxResponse.data,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to check in: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async checkout(
    checkoutDto: CheckoutReservationDto,
    jwtUser: { userId: number; username: string },
  ): Promise<CheckoutResponseDto> {
    // First, get the full user entity from the database
    const user = await this.usersRepository.findOne({
      where: { id: jwtUser.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${jwtUser.userId} not found`);
    }

    // Find the reservation with relations
    const reservation = await this.reservationsRepository.findOne({
      where: { id: checkoutDto.reservationId },
      relations: ['guest', 'host', 'box'],
    });

    if (!reservation) {
      throw new NotFoundException(
        `Reservation with ID ${checkoutDto.reservationId} not found`,
      );
    }

    // Validate that the user is the guest of this reservation
    if (reservation.guest.id !== user.id) {
      throw new BadRequestException(
        'You can only check out of your own reservations',
      );
    }

    // Validate that the guest is of USER type
    if (user.userType !== UserType.USER) {
      throw new BadRequestException(
        'Only guest users (USER type) can check out',
      );
    }

    // Validate reservation status
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException(
        `Cannot check out of reservation with status: ${reservation.status}`,
      );
    }

    // Validate time window (check-out allowed from checkinAt to end of checkoutAt date)
    const now = new Date();
    const checkoutStart = new Date(reservation.checkinAt);
    const checkoutDate = new Date(reservation.checkoutAt);
    const checkoutEnd = new Date(
      checkoutDate.getFullYear(),
      checkoutDate.getMonth(),
      checkoutDate.getDate(),
      23,
      59,
      59,
    ); // End of day

    if (now < checkoutStart || now > checkoutEnd) {
      throw new BadRequestException(
        `Check-out is only allowed between ${checkoutStart.toISOString()} and ${checkoutEnd.toISOString()}`,
      );
    }

    try {
      // Open the box using BoxesService
      const openBoxResponse = await this.boxesService.openBox(
        {
          boxId: parseInt(reservation.box.boxId),
          tokenFormat:
            this.configService.get<number>('DIRECT4ME_TOKEN_FORMAT') ?? 5,
        },
        user,
      );

      // Update reservation status to CHECKED_OUT and record actual check-out time
      reservation.status = ReservationStatus.CHECKED_OUT;
      reservation.actualCheckoutAt = now;
      await this.reservationsRepository.save(reservation);

      return {
        success: true,
        message: `Successfully checked out from box ${reservation.box.boxId}`,
        reservationId: reservation.id,
        boxId: reservation.box.boxId,
        status: reservation.status,
        data: openBoxResponse.data,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to check out: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async cancel(
    reservationId: number,
    jwtUser: { userId: number; username: string },
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId },
      relations: ['guest', 'host'],
    });

    if (!reservation) {
      throw new NotFoundException(
        `Reservation with ID ${reservationId} not found`,
      );
    }

    // Check if the user is either the guest or the host
    if (
      reservation.guest.id !== jwtUser.userId &&
      reservation.host.id !== jwtUser.userId
    ) {
      throw new BadRequestException(
        'Only the guest or host can cancel this reservation',
      );
    }

    // Check if the reservation can be cancelled
    if (reservation.status === ReservationStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Cannot cancel a reservation that is already checked in',
      );
    }

    if (reservation.status === ReservationStatus.CHECKED_OUT) {
      throw new BadRequestException(
        'Cannot cancel a reservation that is already checked out',
      );
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('Reservation is already cancelled');
    }

    // Update the reservation status to CANCELLED
    reservation.status = ReservationStatus.CANCELLED;
    return await this.reservationsRepository.save(reservation);
  }

  // Add new method to automatically update past reservations
  async updatePastReservations(): Promise<void> {
    const now = new Date();

    // Find all reservations that:
    // 1. Have passed their checkout date
    // 2. Are not already CHECKED_OUT or CANCELLED
    const pastReservations = await this.reservationsRepository
      .createQueryBuilder('reservation')
      .where('reservation.checkoutAt < :now', { now })
      .andWhere('reservation.status NOT IN (:...statuses)', {
        statuses: [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED],
      })
      .getMany();

    // Update each past reservation
    for (const reservation of pastReservations) {
      reservation.status = ReservationStatus.CHECKED_OUT;
      reservation.actualCheckoutAt = now;
      await this.reservationsRepository.save(reservation);
    }
  }
}
