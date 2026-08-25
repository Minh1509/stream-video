import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStreamingFieldsToVideos1740000001000
  implements MigrationInterface
{
  name = 'AddStreamingFieldsToVideos1740000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "videos_status_enum" AS ENUM ('processing', 'ready', 'failed')`,
    );

    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN "hls_master_url" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN "status" "videos_status_enum" NOT NULL DEFAULT 'processing'`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN "duration" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN "source_filename" text NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP COLUMN "source_filename"`,
    );
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "duration"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "status"`);
    await queryRunner.query(
      `ALTER TABLE "videos" DROP COLUMN "hls_master_url"`,
    );
    await queryRunner.query(`DROP TYPE "videos_status_enum"`);
  }
}
