import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
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

  @Post(':id/stream/token')
  issueStreamToken(
    @Param('id') id: string,
    @Body('accessKey') accessKey: string,
  ): { token: string } {
    const token = this.videosService.issueStreamToken(id, accessKey);
    return { token };
  }

  @Get(':id/stream/key')
  async getStreamKey(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const keyBuffer = await this.videosService.getStreamKey(id, token);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', keyBuffer.length);
    res.end(keyBuffer);
  }
}
