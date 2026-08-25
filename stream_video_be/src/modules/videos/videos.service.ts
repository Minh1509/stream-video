import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { CreateVideoDto } from './dto/create-video.dto';
import { Video, VideoStatus } from './entities/video.entity';
import {
  TRANSCODE_JOB,
  TRANSCODE_QUEUE,
  TranscodeJobData,
} from './transcode-queue/transcode-queue.constant';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectQueue(TRANSCODE_QUEUE)
    private readonly transcodeQueue: Queue<TranscodeJobData>,
  ) {}

  async findAll(): Promise<Video[]> {
    return this.videoRepository.find({
      where: { status: VideoStatus.READY },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Video> {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException(`Video with id "${id}" not found`);
    }
    return video;
  }

  async createFromUpload(
    dto: CreateVideoDto,
    file: Express.Multer.File,
  ): Promise<Video> {
    const video = this.videoRepository.create({
      title: dto.title,
      description: dto.description ?? '',
      sourceFilename: file.originalname,
      status: VideoStatus.PROCESSING,
    });
    const saved = await this.videoRepository.save(video);

    // Enqueue transcode job
    await this.transcodeQueue.add(
      TRANSCODE_JOB,
      { videoId: saved.id, inputPath: file.path },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return saved;
  }
}
