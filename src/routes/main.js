/**
 * @summary Koa router for the main top-level pages.
 * @module @mattduffy/koa-stub
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/routes/main.js The router for the top level app URLs.
 */

import { rename } from 'node:fs/promises'
import path from 'node:path'
import formidable from 'formidable'
import Router from '@koa/router'
import { ulid } from 'ulid'
import {
  _log,
  _error,
  // getSetName,
  // TOWNS,
} from '../utils/logging.js'
import { Exiftool } from '@mattduffy/exiftool'
// import { redis } from '../daos/impl/redis/redis-om.js'
// import { redis as ioredis } from '../daos/impl/redis/redis-client.js'

const mainLog = _log.extend('main')
const mainError = _error.extend('main')
/* eslint-disable-next-line no-unused-vars */
function sanitize(param) {
  // fill in with some effective input scubbing logic
  return param
}
function sanitizeFilename(filename) {
  // Remove whitespace characters from filename.
  // Remove non-word characters from filename.
  /* eslint-disable-next-line */
  const cleanName = filename.replace(/[\s!@#\$%&*\(\)](?!(\.\w{1,4}$))/g, '_')
  console.log(`Sanitizing filename ${filename} to ${cleanName}`)
  return cleanName
}

const router = new Router()
async function hasFlash(ctx, next) {
  const log = mainLog.extend('hasFlash')
  const error = mainError.extend('hasFlash')
  if (ctx.flash) {
    log('ctx.flash is present: %o', ctx.flash)
  } else {
    error('ctx.flash is missing.')
  }
  await next()
}

router.get('index', '/', hasFlash, async (ctx) => {
  const log = mainLog.extend('index')
  // const error = mainError.extend('index')
  log('inside main router: /')
  ctx.status = 200
  const locals = {}
  locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
  const csrfToken = ulid()
  ctx.session.csrfToken = csrfToken
  ctx.cookies.set('csrfToken', csrfToken, { httpOnly: true, sameSite: 'strict' })
  locals.csrfToken = csrfToken
  locals.body = ctx.body
  locals.origin = ctx.request.href
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: Home`
  locals.sessionUser = ctx.state.sessionUser
  locals.jwtAccess = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  // locals.items = items
  await ctx.render('index', locals)
})

router.post('fileUpload', '/upload', async (ctx) => {
  const log = mainLog.extend('POST-upload')
  const error = mainError.extend('POST-upload')
  const opts = {
    encoding: 'utf-8',
    uploadDir: ctx.app.dirs.private.uploads,
    keepExtensions: true,
    multipart: true,
  }
  log(opts)
  const form = formidable(opts)
  await new Promise((resolve, reject) => {
    form.parse(ctx.req, (err, fields, files) => {
      if (err) {
        error('There was a problem parsing the multipart form data.')
        error(err)
        reject(err)
        return
      }
      log('Multipart form data was successfully parsed.')
      ctx.request.body = fields
      ctx.request.files = files
      log(files)
      log(fields)
      resolve()
    })
  })
  const csrfTokenCookie = ctx.cookies.get('csrfToken')
  const csrfTokenSession = ctx.session.csrfToken
  const csrfTokenHidden = ctx.request.body.csrfTokenHidden[0]
  if (csrfTokenCookie === csrfTokenSession) log('cookie === session')
  if (csrfTokenCookie === csrfTokenHidden) log('hidden === cookie')
  if (csrfTokenSession === csrfTokenHidden) log('session === hidden')
  if (!(csrfTokenCookie === csrfTokenSession && csrfTokenSession === csrfTokenHidden)) {
    error(`CSRF-Token mismatch: header:${csrfTokenCookie}`)
    error(`                     hidden:${csrfTokenHidden}`)
    error(`                    session:${csrfTokenSession}`)
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 401
    ctx.body = { error: 'csrf token mismatch' }
  } else {
    log('csrf token check passed')
    const image = ctx.request.files.image_0[0]
    let imageOriginalFilenameCleaned
    let imageSaved
    const shortcuts = {
      Location: 'Location',
      Basic: 'BasicShortcut',
      Full: null,
    }
    // check if the url field was submitted
    let urlToInspect
    if (ctx.request.body?.url[0] !== '') {
      urlToInspect = ctx.request.body.url[0]
      log(urlToInspect)
    }
    const exifShortcut = shortcuts[`${ctx.request.body?.tagSet}`] ?? false
    log(`exifShortcut = ${exifShortcut}`)
    const response = {}
    try {
      log(image.size)
      if (image.size > 0) {
        imageOriginalFilenameCleaned = sanitizeFilename(image.originalFilename)
        const prefix = image.newFilename.slice(0, image.newFilename.lastIndexOf('.'))
        imageSaved = path.resolve(`${ctx.app.root}/inspected/${prefix}_${imageOriginalFilenameCleaned}`)
        const isMoved = await rename(image.filepath, imageSaved)
        log(`${imageSaved} moved successfully? ${(isMoved === undefined)}`)
      }
    } catch (e) {
      error(`Failed to move ${image.filepath} to the ${imageSaved}.`)
      response.msg = `Failed to move ${image.filepath} to the inspected/ dir.`
    }
    let exiftool = new Exiftool()
    try {
      // run exif command here
      exiftool = await exiftool.init(imageSaved)
      const result = await exiftool.setConfigPath(`${ctx.app.root}/src/exiftool.config`)
      // log(`exiftool config path set: ${result.toString()}`)
      log('exiftool config path set: %o', result)
      // response.metadata = await exiftool.getMetadata()
      response.metadata = await exiftool.getMetadata('', exifShortcut)
    } catch (e) {
      error(e)
      error(`Failed to run exif command on ${imageSaved}`)
      response.msg = `Failed to run exif command on ${imageSaved}`
      response.e = e
    }
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 200
    ctx.body = response
  }
})

// router.get('about', '/about', hasFlash, async (ctx) => {
//   const log = mainLog.extend('about')
//   // const error = mainError.extend('about')
//   log('inside index router: /about')
//   ctx.status = 200
//   await ctx.render('about', {
//     body: ctx.body,
//     title: `${ctx.app.site}: About`,
//     sessionUser: ctx.state.sessionUser,
//     isAuthenticated: ctx.state.isAuthenticated,
//   })
// })
//
// router.get('contact', '/contact', hasFlash, async (ctx) => {
//   const log = mainLog.extend('contact')
//   // const error = mainError.extend('contact')
//   log('inside index router: /contact')
//   ctx.status = 200
//   await ctx.render('contact', {
//     title: `${ctx.app.site}: Contact`,
//     sessionUser: ctx.state.sessionUser,
//     isAuthenticated: ctx.state.isAuthenticated,
//   })
// })
export { router as main }
