import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateVideoDto } from './dto/create-video.dto';
import { Video } from './entities/video.entity';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  async findAll(): Promise<{ data: Video[] }> {
    const data = await this.videosService.findAll();
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{ data: Video }> {
    const data = await this.videosService.findOne(id);
    return { data };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() dto: CreateVideoDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ data: Video }> {
    if (!file) {
      throw new BadRequestException('A video file is required (field "file")');
    }
    if (!dto.title?.trim()) {
      throw new BadRequestException('title is required');
    }
    const data = await this.videosService.createFromUpload(dto, file);
    return { data };
  }
}
