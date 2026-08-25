import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEncryptionKeyToVideos1740000002000 implements MigrationInterface {
  name = 'AddEncryptionKeyToVideos1740000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN "encryption_key" varchar(32) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP COLUMN "encryption_key"`,
    );
  }
}
