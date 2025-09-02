/**
 * @module @mattduffy/exif-inspector
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @summary Koa router for the Apple MapKit api endpoints.
 * @file src/routes/mapkit.js
 */

import path from 'node:path'
import { readFile } from 'node:fs/promises'
import Router from '@koa/router'
// import {
//   FT_AGGREGATE_GROUP_BY_REDUCERS as AggregateGroupByReducers,
//   FT_AGGREGATE_STEPS as AggregateSteps,
// } from 'redis'
// import { redis } from '../daos/impl/redis/redis-client.js'
import {
  _log,
  _info,
  _error,
} from '../utils/logging.js'

const Log = _log.extend('mapkit')
const Info = _info.extend('mapkit')
const Error = _error.extend('mapkit')
const router = new Router()

function sanitize(param) {
  return param
}

router.get('mapkitLocate', '/mapkit/locate/:lon/:lat/:radius/:units', async (ctx) => {
  const log = Log.extend('locate')
  const info = Info.extend('locate')
  const error = Error.extend('locate')
  if (ctx.state.isAsyncRequest === true) {
    log('Async query received.')
  }
  const lon = (/^-?\d{1,3}\.\d{1,16}$/.exec(sanitize(ctx.params.lon)))?.input
  const lat = (/^-?\d{1,3}\.\d{1,16}$/.exec(sanitize(ctx.params.lat)))?.input
  const radius = parseInt(sanitize(ctx.params.radius.slice(0, 3)), 10)
  const units = ['m', 'km', 'mi', 'ft'].find((u) => u === sanitize(ctx.params.units))
  info(`locate piers within ${radius} ${units} of coords: ${lon}, ${lat}`)

  const csrfTokenCookie = ctx.cookies.get('csrfToken')
  const csrfTokenSession = ctx.session.csrfToken
  info(`${csrfTokenCookie},\n${csrfTokenSession}`)
  if (csrfTokenCookie === csrfTokenSession) info('cookie === session')
  if (!(csrfTokenCookie === csrfTokenSession)) {
    error(`CSR-Token mismatch: header:${csrfTokenCookie} - session:${csrfTokenSession}`)
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 401
    ctx.body = { error: 'csrf token mismatch' }
  } else {
    let result
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 200
    try {
      // what goes here?
    } catch (e) {
      error('Failed to locate ...', e)
      ctx.status = 500
      result = { error: 'Failed to locate' }
    }
    ctx.body = result
  }
})

router.get('mapkitGetToken', '/mapkit/getToken', async (ctx) => {
  const log = Log.extend('get-token')
  const info = Info.extend('get-token')
  const error = Error.extend('get-token')
  if (ctx.state.isAsyncRequest === true) {
    log('Async query received.')
  }
  let mapKitAccessToken
  const csrfTokenCookie = ctx.cookies.get('csrfToken')
  const csrfTokenSession = ctx.session.csrfToken
  info(`${csrfTokenCookie},\n${csrfTokenSession}`)
  if (csrfTokenCookie === csrfTokenSession) info('cookie === session')
  if (!(csrfTokenCookie === csrfTokenSession)) {
    error(`CSR-Token mismatch: header:${csrfTokenCookie} - session:${csrfTokenSession}`)
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 401
    ctx.body = { error: 'csrf token mismatch' }
  } else {
    try {
      const mapKitTokenPath = path.resolve(ctx.app.dirs.keys, 'mapkit', 'mapkit.jwt')
      mapKitAccessToken = await readFile(mapKitTokenPath, { encoding: 'utf-8' })
      info(`mapkit token: ${sanitize(mapKitAccessToken)}`)
    } catch (e) {
      error(e)
      error('Failed to get mapkit token from file.')
      ctx.type = 'application/json; charset=utf-8'
      ctx.status = 401
      ctx.body = { error: 'Failed to get mapkit token from file.' }
    }
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 200
    ctx.body = { tokenID: mapKitAccessToken }
  }
})

export { router as mapkit }
