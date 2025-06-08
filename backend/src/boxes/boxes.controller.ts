import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UnauthorizedException,
  Query,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { BoxesService } from './boxes.service';
import { CreateBoxDto } from './dto/create-box.dto';
import { UpdateBoxDto } from './dto/update-box.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Box } from './entities/box.entity';
import { OpenBoxDto } from './dto/open-box.dto';
import { UsersService } from '../users/users.service';
import { UnlockHistory } from './entities/unlock-history.entity';

interface RequestWithUser extends Request {
  user?: { userId: number };
}

@ApiTags('boxes')
@ApiBearerAuth('access-token')
@Controller('api/boxes')
@UseGuards(JwtAuthGuard)
export class BoxesController {
  constructor(
    private readonly boxesService: BoxesService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('images', 10)) // Allow up to 10 images
  @ApiOperation({
    summary: 'Create a new box',
    description:
      'Create a new box with optional image uploads. Supports both JSON and multipart/form-data requests.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    description: 'Box creation data with optional images',
    schema: {
      type: 'object',
      properties: {
        boxId: {
          type: 'string',
          description: 'The unique identifier of the box',
          example: 'BOX123',
        },
        location: {
          type: 'string',
          description: 'The location of the box',
          example: 'Building A, Floor 1',
        },
        ownerId: {
          type: 'string',
          description: 'The ID of the host who owns this box',
          example: '123',
        },
        pricePerNight: {
          type: 'string',
          description: 'Price per night for the box',
          example: '25.99',
        },
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Image files for the box (max 10 files)',
        },
      },
      required: ['boxId', 'location', 'ownerId', 'pricePerNight'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'The box has been successfully created.',
    type: Box,
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 409, description: 'Box with this ID already exists.' })
  create(@Body() createBoxDto: CreateBoxDto, @UploadedFiles() images?: any[]) {
    // If images are provided, use the createWithImages method
    if (images && images.length > 0) {
      return this.boxesService.createWithImages(createBoxDto, images);
    }

    // Otherwise, use the regular create method
    return this.boxesService.create(createBoxDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all boxes' })
  @ApiResponse({
    status: 200,
    description: 'Return all boxes.',
    type: [Box],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAll() {
    return this.boxesService.findAll();
  }

  @Get('host/:hostId')
  @ApiOperation({ summary: 'Get all boxes belonging to a specific host' })
  @ApiResponse({
    status: 200,
    description: 'Return all boxes belonging to the specified host.',
    type: [Box],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 404,
    description: 'Host not found or no boxes found.',
  })
  findByHostId(@Param('hostId') hostId: string) {
    return this.boxesService.findByHostId(+hostId);
  }

  @Get('opening-history')
  @ApiOperation({ summary: 'Get all box opening history' })
  @ApiResponse({
    status: 200,
    description: 'Return all opening history.',
    type: [UnlockHistory],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getAllOpeningHistory() {
    return this.boxesService.getOpeningHistory();
  }

  @Get('opening-history/box/:boxId')
  @ApiOperation({ summary: 'Get opening history for a specific box' })
  @ApiResponse({
    status: 200,
    description: 'Return opening history for the specified box.',
    type: [UnlockHistory],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getOpeningHistoryByBoxId(@Param('boxId') boxId: string) {
    return this.boxesService.getOpeningHistoryByBoxId(boxId);
  }

  @Get('opening-history/user/:userId')
  @ApiOperation({ summary: 'Get opening history for a specific user' })
  @ApiResponse({
    status: 200,
    description: 'Return opening history for the specified user.',
    type: [UnlockHistory],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getOpeningHistoryByUserId(@Param('userId') userId: string) {
    return this.boxesService.getOpeningHistoryByUserId(+userId);
  }

  @Get('opening-history/host/:hostId')
  @ApiOperation({
    summary: 'Get opening history for all boxes belonging to a specific host',
  })
  @ApiResponse({
    status: 200,
    description:
      'Return opening history for all boxes belonging to the specified host.',
    type: [UnlockHistory],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 404,
    description: 'Host not found or no boxes found.',
  })
  async getOpeningHistoryByHostId(@Param('hostId') hostId: string) {
    return this.boxesService.getOpeningHistoryByHostId(+hostId);
  }

  @Post('open')
  @ApiOperation({ summary: 'Open a box' })
  @ApiResponse({ status: 200, description: 'Box successfully opened.' })
  @ApiResponse({ status: 400, description: 'Invalid request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async openBox(
    @Body() openBoxDto: OpenBoxDto,
    @Req() req: RequestWithUser,
  ): Promise<any> {
    if (!req.user?.userId) throw new UnauthorizedException();
    const user = await this.usersService.findOne(req.user.userId);
    return this.boxesService.openBox(openBoxDto, user);
  }

  @Get(':boxId')
  @ApiOperation({ summary: 'Get a box by boxId' })
  @ApiResponse({
    status: 200,
    description: 'Return the box.',
    type: Box,
  })
  @ApiResponse({ status: 404, description: 'Box not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findOne(@Param('boxId') boxId: string) {
    return this.boxesService.findOneByBoxId(boxId);
  }

  @Patch(':boxId')
  @ApiOperation({ summary: 'Update a box by boxId' })
  @ApiResponse({
    status: 200,
    description: 'The box has been successfully updated.',
    type: Box,
  })
  @ApiResponse({ status: 404, description: 'Box not found.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 409, description: 'Box with this ID already exists.' })
  update(@Param('boxId') boxId: string, @Body() updateBoxDto: UpdateBoxDto) {
    return this.boxesService.updateByBoxId(boxId, updateBoxDto);
  }

  @Delete(':boxId')
  @ApiOperation({ summary: 'Delete a box by boxId' })
  @ApiResponse({
    status: 200,
    description: 'The box has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Box not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  remove(@Param('boxId') boxId: string) {
    return this.boxesService.removeByBoxId(boxId);
  }

  @Get(':boxId/availability')
  @ApiOperation({ summary: 'Get box availability schedule' })
  @ApiResponse({
    status: 200,
    description:
      'Returns the box availability schedule showing future unavailable dates',
  })
  @ApiResponse({ status: 404, description: 'Box not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getBoxAvailability(@Param('boxId') boxId: string) {
    return this.boxesService.getBoxAvailability(boxId);
  }

  @Get(':boxId/revenue')
  @ApiOperation({ summary: 'Get revenue for a specific box' })
  @ApiResponse({
    status: 200,
    description: 'Return revenue for the specified box.',
    schema: {
      type: 'object',
      properties: {
        totalRevenue: { type: 'number' },
        totalBookings: { type: 'number' },
        averageRevenuePerBooking: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getBoxRevenue(
    @Param('boxId') boxId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.boxesService.calculateBoxRevenue(
      boxId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('host/:hostId/revenue')
  @ApiOperation({ summary: "Get revenue for all host's boxes" })
  @ApiResponse({
    status: 200,
    description: "Return revenue for all host's boxes.",
    schema: {
      type: 'object',
      properties: {
        totalRevenue: { type: 'number' },
        totalBookings: { type: 'number' },
        boxesRevenue: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              boxId: { type: 'string' },
              revenue: { type: 'number' },
              bookings: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getHostRevenue(
    @Param('hostId') hostId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.boxesService.getHostRevenue(
      hostId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
