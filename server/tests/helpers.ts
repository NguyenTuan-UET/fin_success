import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { buildApp, type AppOptions, type FccApp } from '../src/app'
import { Database } from '../src/state'

/**
 * CSDL kiểm thử: TEST_DATABASE_URL, mặc định là cụm cục bộ do scripts/pg-local.sh dựng (CSDL fcc_test).
 * Mỗi file test dùng một schema riêng và xóa schema khi kết thúc.
 */
export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? `postgres://fcc@/fcc_test?host=${resolve('data/pg-run')}&port=5433`
export const LISTED_DIR = '../web-legacy/public/listed'

export const newSchema = () => `t_${randomBytes(6).toString('hex')}`

export function startApp(schema: string, opt: Partial<AppOptions> = {}): Promise<FccApp> {
  return buildApp({ dbUrl: TEST_DB_URL, dbSchema: schema, listedDir: LISTED_DIR, ...opt })
}

export async function dropSchema(schema: string) {
  const db = await Database.open(TEST_DB_URL, schema)
  await db.dropSchema()
  await db.close()
}
