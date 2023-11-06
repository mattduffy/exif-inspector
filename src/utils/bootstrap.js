/**
 * @module @mattduffy/koa-glp
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/utils/bootstrap.js The script to bootstrap the app.
 */

import path from 'node:path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
/* eslint-disable-next-line */
import * as Users from '@mattduffy/users/Users.js'
import * as mongoClient from '../daos/impl/mongodb/mongo-client.js'
// import * as redis from '../daos/impl/redis/redis-client.js'
import { App } from '../models/app.js'
// import { Users } from '../models/users.js'
import { _log, _error } from './logging.js'

const log = _log.extend('utils-bootstrap')
const error = _error.extend('utils-bootstrap')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(`${__dirname}/../..`)
const appEnv = {}
dotenv.config({ path: path.resolve(appRoot, 'config/app.env'), processEnv: appEnv, debug: true })
// log(appEnv)
const bootEnv = {}
dotenv.config({ path: path.resolve(appRoot, 'config/bootstrap.env'), processEnv: bootEnv, debug: true })
const mongoEnv = {}
dotenv.config({ path: path.resolve(appRoot, 'config/mongodb.env'), processEnv: mongoEnv, debug: true })
log(mongoEnv)

// Bootstrap the app collection in the db.
log(mongoClient.uri)
const config = {
  keyDir: `${appRoot}/keys`,
  // db: mongoClient.client,
  db: mongoClient.client.db(mongoEnv.MONGODB_DBNAME),
  siteName: appEnv.SITE_NAME,
  appEnv,
}
const app = new App(config)
try {
  await app.init()
} catch (e) {
  error('Failed to bootstrap the app db collection.')
  error(e)
  throw new Error('App.init() failed.', { cause: e })
}
try {
  const keys = await app.keys()
  log(keys)
} catch (e) {
  error('Failed to crete the app keys.')
  throw new Error('App.keys() failed.', { cause: e })
}

// Bootstrap an admin user account.
const rando = crypto.randomBytes(2).toString('hex')
const at = bootEnv.EMAIL.indexOf('@')
const email = `${bootEnv.EMAIL.slice(0, at)}${rando}${bootEnv.EMAIL.slice(at)}`
const ctx = {
  app: {
    root: appRoot,
    dirs: {
      public: {
        dir: `${appRoot}/public`,
      },
      private: {
        dir: `${appRoot}/private`,
      },
    },
  },
}

const _id = new mongoClient.ObjectId()
log(`new mongo _id: ${_id}`)

const adminProps = {
  _id,
  first: bootEnv.FIRST_NAME ?? 'First',
  last: bootEnv.LAST_NAME ?? 'User',
  emails: [{ primary: email ?? 'first_user@exif-inspector.com', verified: false }],
  description: bootEnv.DESCRIPTION ?? 'The first user account created.',
  username: bootEnv.USERNAME ?? 'firstuser',
  password: bootEnv.PASSWORD,
  jwts: { token: '', refresh: '' },
  userStatus: 'active',
  schemaVer: 0,
  ctx,
  env: appEnv,
  dbName: mongoClient.dbName,
  client: mongoClient.client,

}
try {
  const firstUser = Users.newAdminUser(adminProps)
  log(firstUser)
  // firstUser.publicDir('public/a/')
  // firstUser.privateDir('private/a/')
  firstUser.publicDir = 'a'
  const userKeys = await firstUser.generateKeys()
  log(userKeys)
  const savedFirstUser = await firstUser.save()
  log(savedFirstUser)
} catch (e) {
  error(e)
  throw new Error(e.message, { cause: e })
}

// Bootstrapping done, exit process.
process.exit()
