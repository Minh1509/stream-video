import { AppDataSource } from '../../ormconfig';
import { Video } from '../modules/videos/entities/video.entity';
import VideoSeeder from './seeders/video.seeder';

async function runSeed() {
  const fresh = process.argv.includes('--fresh');
  const dataSource = await AppDataSource.initialize();
  try {
    if (fresh) {
      await dataSource.getRepository(Video).createQueryBuilder().delete().execute();
    }
    const seeder = new VideoSeeder();
    await seeder.run(dataSource);
    console.log(fresh ? 'Re-seeding completed (fresh).' : 'Seeding completed.');
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
