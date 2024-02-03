/**
 * @summary Koa router for the main top-level pages.
 * @module @mattduffy/koa-stub
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/routes/main.js The router for the top level app URLs.
 */

import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import formidable from 'formidable'
import Router from '@koa/router'
import { ulid } from 'ulid'
/* eslint-disable-next-line */
import { Exiftool } from '@mattduffy/exiftool'
/* eslint-disable-next-line */
import get from '@mattduffy/webfinger/get.js'
import {
  _log,
  _error,
} from '../utils/logging.js'

const mainLog = _log.extend('main')
const mainError = _error.extend('main')
/* eslint-disable-next-line no-unused-vars */
function sanitize(param) {
  // fill in with some effective input scrubbing logic
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
  locals.accessToken = ctx.state.searchJwtAccess
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
    const response = {}
    const image = ctx.request.files?.image_0?.[0] ?? null
    let imageOriginalFilenameCleaned
    let imageSaved
    const shortcuts = {
      Basic: 'BasicShortcut',
      Common: 'Common',
      Location: 'Location',
      CAR: 'CAR',
      Full: null,
      StripAllTags: 'StripAllTags',
      StripLocation: 'StripGPS',
    }
    const images = []
    // check if the url field was submitted
    let inspectedName
    let urlToInspect = ctx.request.body?.url?.[0] ?? null
    if (urlToInspect !== null) {
      try {
        urlToInspect = new URL(ctx.request.body.url[0])
        log(urlToInspect)
        const remoteFile = { url: urlToInspect }
        const remoteResponse = await get(urlToInspect)
        log(remoteResponse.statusCode)
        log(remoteResponse.statusMessage)
        log(remoteResponse.contentType)
        const filePath = path.parse(urlToInspect.pathname)
        const fileName = `${ulid()}_${filePath.base}`
        inspectedName = path.resolve(`${ctx.app.root}/inspected/${fileName}`)
        log(`remote file will be written to ${inspectedName}`)
        remoteFile.inspectedFile = fileName
        const written = await writeFile(inspectedName, new Uint8Array(remoteResponse.buffer))
        if (written === undefined) {
          remoteFile.written = true
          response.inspectedFile = fileName
        } else {
          remoteFile.written = false
        }
        response.remoteFile = remoteFile
        images.push(inspectedName)
      } catch (e) {
        error(e)
        error('not a valid URL')
        response.remoteFile = { error: e.message, written: false, url: urlToInspect }
      }
    }
    const exifShortcut = shortcuts[`${ctx.request.body?.tagSet?.[0]}`] ?? false
    log(`exifShortcut = ${exifShortcut}`)
    try {
      log(image?.size)
      // if (image?.size > 0) {
      if (image !== null) {
        imageOriginalFilenameCleaned = sanitizeFilename(image.originalFilename)
        const prefix = image.newFilename.slice(0, image.newFilename.lastIndexOf('.'))
        imageSaved = path.resolve(`${ctx.app.root}/inspected/${prefix}_${imageOriginalFilenameCleaned}`)
        const isMoved = await rename(image.filepath, imageSaved)
        log(`${imageSaved} moved successfully? ${(isMoved === undefined)}`)
        images.push(imageSaved)
        response.inspectedFile = `${prefix}_${imageOriginalFilenameCleaned}`
      }
    } catch (e) {
      error(`Failed to move ${image.filepath} to the ${imageSaved}.`)
      response.msg = `Failed to move ${image.filepath} to the inspected/ dir.`
    }
    let exiftool = new Exiftool()
    try {
      // run exif command here
      log(`image${(images.length > 1) ? 's' : ''} to inspect: `, images)
      exiftool = await exiftool.init(images)
      exiftool.enableBinaryTagOutput(true)
      const expandStructs = true
      exiftool.enableXMPStructTagOutput(expandStructs)
      exiftool.setOverwriteOriginal(false)
      const newConfigPath = await exiftool.setConfigPath(`${ctx.app.root}/config/exiftool.config`)
      // log(`exiftool config path set: ${result.toString()}`)
      log('exiftool config path set: %o', newConfigPath)
      let result
      let stripResult
      if (exifShortcut === 'StripAllTags') {
        stripResult = await exiftool.stripMetadata()
        log(stripResult)
        result = await exiftool.getMetadata('', null, '--ICC_Profile:all')
        if (stripResult?.original) {
          const original = path.parse(stripResult.original)
          response.originalFile = original.base
        }
        response.modifiedFile = (await exiftool.getPath()).file
      } else if (exifShortcut === 'StripGPS') {
        await exiftool.stripLocation()
        result = await exiftool.getMetadata('', null, '--ICC_Profile:all')
        if (result?.original) {
          const original = path.parse(result.original)
          response.originalFile = original.base
        }
        response.modifiedFile = result[0]['File:FileorName']
        log(result)
      } else {
        result = await exiftool.getMetadata('', exifShortcut, '--ICC_Profile:all')
      }
      response.metadata = result
    } catch (e) {
      error(e)
      error(`Failed to run exif command on ${imageSaved}`)
      response.msg = `Failed to run exif command on ${imageSaved}`
      response.e = e
    }
    // don't leak system info to the web page
    delete response.metadata[0]?.SourceFile
    delete response.metadata[0]?.['File:Filename']
    delete response.metadata[0]?.['File:Directory']
    delete response.metadata[0]?.['File:FileModifyDate']
    delete response.metadata[0]?.['File:FileAccessDate']
    delete response.metadata[0]?.['File:FilePermissions']
    delete response.metadata[0]?.['File:FileTypeExtension']
    delete response.metadata[0]?.['File:FileInodeChangeDate']
    delete response.metadata[0]['ExifTool:ExifToolVersion']
    delete response.metadata[1]

    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 200
    ctx.body = response
  }
})

router.get('getEditedFile', '/inspected/:f', async (ctx) => {
  const log = mainLog.extend('GET-editedFile')
  const error = mainError.extend('GET-editedFile')
  const file = sanitize(ctx.params.f)
  if (!file || file === '') {
    error('Missing required file name url parameter.')
    ctx.reponse.status = 401
  } else {
    let edittedFile
    const edittedFilePath = path.resolve(`${ctx.app.root}/inspected/${file}`)
    try {
      log(edittedFilePath)
      edittedFile = await readFile(edittedFilePath)
      const { ext } = path.parse(edittedFilePath)
      const type = `image/${ext.slice(1)}`
      log(ctx.response.status, type, edittedFile)
      ctx.response.status = 200
      ctx.response.type = type
      ctx.response.body = edittedFile
    } catch (e) {
      error(`Failed to open ${edittedFilePath} `)
      error(e)
      ctx.response.status = 404
    }
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
