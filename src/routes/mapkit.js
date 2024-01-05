/**
 * @summary Koa router for the Apple MapKit api endpoints.
 * @module @mattduffy/exif-inspector
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/routes/mapkit.js The router for the Apple MapKit api endpoints.
 */

import Router from '@koa/router'
// import { ulid } from 'ulid'
// import { AggregateGroupByReducers, AggregateSteps } from 'redis'
// import { redis } from '../daos/impl/redis/redis-om.js'
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
  const mapKitAccessToken = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ikc4M1Y3MzJBNzYifQ.eyJpc3MiOiJXWThSNVBQOE43IiwiaWF0IjoxNzA0MzkxMDA0LCJleHAiOjE3MzU4NjI0MDAsIm9yaWdpbiI6Imh0dHBzOi8vZXhpZi1pbnNwZWN0b3IuY29tIn0.JYSdDPMvaI1Co9jnvB8TxOK6BpWLZKN-ruyzTm9-wdjYlpbK-V1YXBCHpIQzoj-HGzc29-xGbJOTOse0AupDDQ'
  info(sanitize(mapKitAccessToken))
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
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 200
    ctx.body = { tokenID: mapKitAccessToken }
  }
})

export { router as mapkit }
