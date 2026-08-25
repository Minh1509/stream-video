import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { Video, VideoStatus } from '../../modules/videos/entities/video.entity';

const MUX = 'https://test-streams.mux.dev';
const APPLE = 'https://devstreaming-cdn.apple.com/videos/streaming/examples';

const SAMPLE_VIDEOS: Array<
  Pick<Video, 'title' | 'description' | 'thumbnailUrl' | 'hlsMasterUrl'>
> = [
  {
    title: 'Big Buck Bunny',
    description:
      'A large and lovable rabbit deals with three tiny bullies in this classic open-source animated short.',
    thumbnailUrl: 'https://picsum.photos/seed/bigbuckbunny/640/360',
    hlsMasterUrl: `${MUX}/x36xhzz/x36xhzz.m3u8`,
  },
  {
    title: 'Tears of Steel',
    description:
      'A sci-fi Blender open movie about a group fighting to save the world from robots.',
    thumbnailUrl: 'https://picsum.photos/seed/tearsofsteel/640/360',
    hlsMasterUrl: `${MUX}/test_001/stream.m3u8`,
  },
  {
    title: 'Apple Basic Stream',
    description:
      'Apple’s reference adaptive HLS stream with multiple bitrates.',
    thumbnailUrl: 'https://picsum.photos/seed/applebasic/640/360',
    hlsMasterUrl: `${APPLE}/bipbop_4x3/bipbop_4x3_variant.m3u8`,
  },
  {
    title: 'Apple Advanced Stream',
    description:
      'Apple’s advanced HLS example with 16:9 renditions and captions.',
    thumbnailUrl: 'https://picsum.photos/seed/appleadvanced/640/360',
    hlsMasterUrl: `${APPLE}/bipbop_16x9/bipbop_16x9_variant.m3u8`,
  },
];

export default class VideoSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<void> {
    const repository = dataSource.getRepository(Video);

    const existing = await repository.count();
    if (existing > 0) {
      return;
    }
    const videos = repository.create(
      SAMPLE_VIDEOS.map((v) => ({ ...v, status: VideoStatus.READY })),
    );
    await repository.save(videos);
  }
}
