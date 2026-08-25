import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { appConfiguration } from '../../configs';
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
    @Inject(appConfiguration.KEY)
    private readonly appConfig: ConfigType<typeof appConfiguration>,
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

  issueStreamToken(videoId: string, accessKey: string): string {
    if (accessKey !== this.appConfig.streamAccessKey) {
      throw new UnauthorizedException('Invalid access key');
    }
    return jwt.sign({ videoId }, this.appConfig.jwtSecret, {
      expiresIn: '2h',
    });
  }

  async getStreamKey(videoId: string, token: string): Promise<Buffer> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.appConfig.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.videoId !== videoId) {
      throw new ForbiddenException('Token does not match this video');
    }

    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException(`Video with id "${videoId}" not found`);
    }
    if (!video.encryptionKey) {
      throw new NotFoundException('Encryption key not found for this video');
    }

    return Buffer.from(video.encryptionKey, 'hex');
  }
}
