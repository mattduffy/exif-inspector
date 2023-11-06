/**
 * @summary Entry point into @mattduffy/users models.
 * @exports @mattduffy/koa-stub
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file ./src/models/users.js
 */
import * as Dotenv from 'dotenv'
import { Users } from '@mattduffy/users'
import { AdminUser } from '@mattduffy/users/AdminUser.js'

if (process.env?.MONGODB_CLIENT_DN === undefined) {
  Dotenv.conf({ path: 'config/mongodb.env', debug: true })
  console.log(process.env)
}

export {
  Users,
  AdminUser,
}
