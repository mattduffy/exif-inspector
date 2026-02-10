/**
 * @summary Koa router for the main top-level pages.
 * @module @mattduffy/koa-stub
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @summary The router for the top level app URLs.
 * @file src/routes/exifinspector.js
 */

import {
  rm, readFile, rename, stat, writeFile,
} from 'node:fs/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import Router from '@koa/router'
import { ulid } from 'ulid'
import { ObjectId } from 'mongodb'
import { fileTypeFromFile } from 'file-type'
import { Exiftool } from '@mattduffy/exiftool'
import get from '@mattduffy/webfinger/get.js'
import {
  addIpToSession,
  processFormData,
  doTokensMatch,
} from './middlewares.js'
import {
  _log,
  _error,
} from '../utils/logging.js'

const exifLog = _log.extend('main')
const exifError = _error.extend('main')
const UPLOADS = 'images_uploaded'
const INSPECTED = 'images_inspected'
const DELETED = 'images_deleted'
function sanitize(param) {
  // fill in with some effective input scrubbing logic
  return param
}
function sanitizeFilename(filename) {
  // Remove whitespace characters from filename.
  // Remove non-word characters from filename.
  const cleanName = filename.replaceAll(
    /* /[(\s?)!@#\$%&*\(\)]|((?<=%)\d{2})(?!\.\D{2,5})/g, */
    // eslint no-useless-escape
    /[(\s?)!@#$%&*()]|((?<=%)\d{2})(?!\.\D{2,5})/g,
    '_',
  )
  console.log(`Sanitizing filename ${filename} to ${cleanName}`)
  return cleanName
}
async function ensureFileExtension(file, og) {
  const log = exifLog.extend('ensureFileExtension')
  log('checking for missing file extension', og)
  let ext
  const parts = path.parse(og)
  if (parts.ext === '') {
    log('file path:', file)
    const mimeType = await fileTypeFromFile(file)
    log('mime type?', mimeType)
    ext = `.${mimeType.ext}`
    log(`${og}.${ext}`)
  } else {
    ext = ''
  }
  return ext
}

function removeServerDetails(data) {
  const d = data
  delete d.metadata[0]?.SourceFile
  delete d.metadata[0]?.['File:FileName']
  delete d.metadata[0]?.['File:Directory']
  delete d.metadata[0]?.['File:FileModifyDate']
  delete d.metadata[0]?.['File:FileAccessDate']
  delete d.metadata[0]?.['File:FilePermissions']
  delete d.metadata[0]?.['File:FileTypeExtension']
  delete d.metadata[0]?.['File:FileInodeChangeDate']
  // delete d.metadata[0]['ExifTool:ExifToolVersion']
  delete d.metadata[1]
  return d
}

const router = new Router()
async function hasFlash(ctx, next) {
  const log = exifLog.extend('hasFlash')
  const error = exifError.extend('hasFlash')
  if (ctx.flash) {
    log('ctx.flash is present: %o', ctx.flash)
  } else {
    error('ctx.flash is missing.')
  }
  await next()
}

router.get('index', '/', addIpToSession, hasFlash, async (ctx) => {
  const log = exifLog.extend('index')
  // const error = exifError.extend('index')
  log('inside main router: /')
  ctx.status = 200
  const locals = {}
  locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
  const csrfToken = ulid()
  ctx.session.csrfToken = csrfToken
  ctx.cookies.set('csrfToken', csrfToken, { httpOnly: true, sameSite: 'strict' })
  locals.csrfToken = csrfToken
  locals.body = ctx.body
  locals.domain = ctx.state.origin
  // locals.origin = ctx.request.href
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: Home`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  // locals.items = items
  await ctx.render('index', locals)
})

router.post('fileUpload', '/upload', addIpToSession, processFormData, async (ctx) => {
  const log = exifLog.extend('POST-upload')
  const error = exifError.extend('POST-upload')
  const csrfTokenCookie = ctx.cookies.get('csrfToken')
  const csrfTokenSession = ctx.session.csrfToken
  const csrfTokenHidden = ctx.request.body.csrfTokenHidden[0]
  if (csrfTokenCookie === csrfTokenSession) log('cookie === session')
  if (csrfTokenCookie === csrfTokenHidden) log('cookie === hidden')
  if (csrfTokenSession === csrfTokenHidden) log('session === hidden')
  if (!doTokensMatch(ctx)) {
    error(`CSRF-Token mismatch: header:${csrfTokenCookie}`)
    error(`                     hidden:${csrfTokenHidden}`)
    error(`                    session:${csrfTokenSession}`)
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 401
    ctx.body = { error: 'csrf token mismatch' }
  } else {
    log('csrf token check passed')
    const response = {}
    const image = ctx.request.files?.image_0?.[0] ?? {
      filepath: null,
      newFilename: null,
      originalFilename: null,
      mimetype: null,
      size: null,
      lastModifiedDate: null,
    }
    // log('IMAGE obj', image)
    let imageOriginalFilenameCleaned
    let imageSaved
    const shortcuts = {
      Basic: 'BasicShortcut',
      Common: 'Common',
      Location: 'Location',
      CAR: 'CAR',
      Full: null,
      XMP: 'XMP',
      StripAllTags: 'StripAllTags',
      StripLocation: 'StripGPS',
    }
    const images = []
    // check if the url field was submitted
    // let inspectedName
    const objectId = new ObjectId()
    let uploadedName
    let urlToInspect = ctx.request.body?.url?.[0] ?? null
    const geo = ctx.state.logEntry?.geos?.[0]
    const uploadDoc = {
      _id: objectId,
      date: new Date(),
      ip: geo?.ip ?? null,
      geo,
      coords: {
        type: 'Point',
        // mongodb requires longitude, latitude order
        coordinates: [(geo?.coords?.[1] ?? 0), (geo?.coords?.[0] ?? 0)],
      },
    }
    if (geo?.coords) {
      delete geo.coords
    }
    if (urlToInspect !== null) {
      try {
        urlToInspect = new URL(ctx.request.body.url[0])
        log(urlToInspect);
        [uploadDoc.remoteUrl] = ctx.request.body.url
        const remoteFile = { url: urlToInspect }
        const remoteResponse = await get(urlToInspect, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
              + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
            Referer: `${(new URL(urlToInspect)).origin}`,
          },
        })
        log('remoteResponse', remoteResponse)
        log(remoteResponse.statusCode)
        log(remoteResponse.statusMessage)
        log(remoteResponse.contentType)
        if (remoteResponse.statusCode > 200
          || /^(?!image)/.test(remoteResponse.contentType)
        ) {
          // short circuit rest of route handler because remote server blocked request
          // handle the block in the client-side js
          ctx.type = 'application/json; charset=utf-8'
          ctx.staus = 200
          ctx.body = remoteResponse
          return
        }
        const filepath = path.parse(urlToInspect.pathname)
        const filename = `${filepath.base}`
        // const newFilename = `${ulid()}${filepath.ext}`
        const newFilename = `${objectId.toString()}${filepath.ext}`
        image.newFilename = newFilename
        image.originalFilename = filename
        image.size = Number.parseInt(remoteResponse.headers['content-length'], 10)
        image.mimetype = remoteResponse.headers['content-type']
        // uploadedName = path.resolve(`${ctx.app.root}/uploads/${newFilename}`)
        uploadedName = path.resolve(`${ctx.app.root}/${UPLOADS}/${newFilename}`)
        uploadDoc.uploadedFile = uploadedName
        image.filepath = uploadedName
        log(`remote file will be uploaded to ${uploadedName}`)
        remoteFile.uploadedFile = filename
        remoteFile.size = remoteResponse.headers['content-length']
        remoteFile.mimetype = remoteResponse.headers['content-type']
        const written = await writeFile(
          uploadedName,
          new Uint8Array(remoteResponse.buffer),
        )
        if (written === undefined) {
          remoteFile.written = true
          response.uploadedFile = filename
          response.inspectedFile = filename
        } else {
          remoteFile.written = false
        }
        response.remoteFile = remoteFile
      } catch (e) {
        error(e)
        error('not a valid URL')
        response.remoteFile = { error: e.message, written: false, url: urlToInspect }
      }
      log('REMOTE IMAGE', image)
    }
    const exifShortcut = shortcuts[`${ctx.request.body?.tagSet?.[0]}`] ?? false
    log(`exifShortcut = ${exifShortcut}`)
    log(`image size: ${image?.size} bytes`)
    if (image?.size === 0) {
      try {
        log(image.filepath)
        const delete0ByteFile = await rm(image.filepath, { force: true })
        log('0 byte file deleted - should be undefined', delete0ByteFile)
      } catch (e) {
        error(e)
      }
      ctx.type = 'application/json; charset=utf-8'
      ctx.status = 200
      ctx.body = {
        error: 'Empty File',
        written: false,
        file: image,
      }
    } else {
      try {
        if (image !== null) {
          imageOriginalFilenameCleaned = `${sanitizeFilename(image.originalFilename)}`
            + `${await ensureFileExtension(image.filepath, image.originalFilename)}`
          // const prefix = image.newFilename.slice(0, image.newFilename.lastIndexOf('.'))
          imageSaved = path.resolve(
            // `${ctx.app.root}/${INSPECTED}/${prefix}_${imageOriginalFilenameCleaned}`,
            `${ctx.app.root}/${INSPECTED}/${objectId}_${imageOriginalFilenameCleaned}`,
          )
          log('image file path:', path.parse(imageSaved))
          const isMoved = await rename(image.filepath, imageSaved)
          log(`${imageSaved} moved successfully? ${(isMoved === undefined)}`)
          // response.inspectedFile = `${prefix}_${imageOriginalFilenameCleaned}`
          response.inspectedFile = `${objectId}_${imageOriginalFilenameCleaned}`
          uploadDoc.imageTempName = image.newFilename
          uploadDoc.uploadedFile = image.originalFilename
          uploadDoc.sanitizedFile = imageOriginalFilenameCleaned
          uploadDoc.inspectedFile = imageSaved
          uploadDoc.size = image.size
          images.push(imageSaved)
        } else {
          // somehow image upload is null
          ctx.type = 'application/json; charset=utf-8'
          ctx.status = 200
          ctx.body = {
            error: 'Empty File',
            written: false,
            file: image,
          }
        }
      } catch (e) {
        error(`Failed to move ${image.filepath} to the ${imageSaved}.`)
        response.msg = `Failed to move ${image.filepath} to the ${INSPECTED}/ dir.`
      }
      try {
        log('saving file upload details to db.')
        log(uploadDoc)
        const db = ctx.state.mongodb.client.db()
        const collection = db.collection('images')
        const dbSaved = await collection.insertOne(uploadDoc)
        log(dbSaved)
      } catch (e) {
        error('failed to save image upload details to db.')
        error(`upload image name:     ${image.originalFilename}`)
        error(`sanitized image namee: ${imageOriginalFilenameCleaned}`)
        error(e)
      }
      let exiftool = new Exiftool()
      try {
        // run exif command here
        log(`image${(images.length > 1) ? 's' : ''} to inspect: `, images)
        exiftool = await exiftool.init(images)
        const expandStructs = true
        exiftool.enableXMPStructTagOutput(expandStructs)
        exiftool.setGPSCoordinatesOutputFormat('+gps')
        exiftool.enableBinaryTagOutput(true)
        exiftool.setOverwriteOriginal(false)
        const newConfigPath = await exiftool.setConfigPath(
          `${ctx.app.root}/config/exiftool.config`,
        )
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
          // response.modifiedFile = result[0]['File:FileorName']
          response.modifiedFile = (await exiftool.getPath()).file
          log(result)
        } else {
          result = await exiftool.getMetadata(
            '',
            exifShortcut,
            'All',
            '-Photoshop:PhotoshopThumbnail',
            '--ICC_Profile:all',
          )
        }
        response.metadata = result
      } catch (e) {
        error(e)
        error(`Failed to run exif command on ${imageSaved}`)
        response.msg = `Failed to run exif command on ${imageSaved}`
        response.e = e
      }
      // don't leak system info to the web page
      const cleanResponse = removeServerDetails(response)
      ctx.type = 'application/json; charset=utf-8'
      ctx.status = 200
      // ctx.body = response
      ctx.body = cleanResponse
    }
  }
})

router.post('editCAR', '/editCAR', addIpToSession, processFormData, async (ctx) => {
  const log = exifLog.extend('POST-editCAR')
  const error = exifError.extend('POST-editCAR')
  const csrfTokenCookie = ctx.cookies.get('csrfToken')
  const csrfTokenSession = ctx.session.csrfToken
  const csrfTokenHidden = ctx.request.body.csrfTokenHidden[0]
  if (csrfTokenCookie === csrfTokenSession) log('cookie === session')
  if (csrfTokenSession === csrfTokenHidden) log('session === hidden')
  if (csrfTokenCookie === csrfTokenHidden) log('hidden === cookie')
  if (!doTokensMatch(ctx)) {
    error(`CSRF-Token mismatch: header:${csrfTokenCookie}`)
    error(`                     hidden:${csrfTokenHidden}`)
    error(`                    session:${csrfTokenSession}`)
    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 401
    ctx.body = { error: 'csrf token mismatch' }
  } else {
    const [filename] = ctx.request.body.inspectedFilename ?? null
    const imageFile = path.resolve(`${ctx.app.root}/${INSPECTED}/${filename}`)
    const response = {}
    const tagArray = []
    let stats
    let exiftool = new Exiftool()
    let newCARs
    let result
    const tags = ctx.request.body
    delete tags.inspectedFilename
    delete tags.csrfTokenHidden
    log(tags)
    /* eslint-disable no-nested-ternary */
    const description = (tags?.['IPTC:Caption-Abstract'])
      ? tags['IPTC:Caption-Abstract'][0]
      : ((tags?.['EXIF:ImageDescription']) ? tags['EXIF:ImageDescription'][0]
        : tags?.['XMP:Description']) ? tags['XMP:Description'][0] : null ?? undefined
    log('-MWG:Description', description)
    if (description) {
      tagArray.push(`-MWG:Description= -MWG:Description="${description}"`)
      delete tags['IPTC:Caption-Abstract']
      delete tags['EXIF:ImageDescription']
      delete tags['XMP:Description']
    }
    const keywords = (tags?.['IPTC:Keywords']) ? tags['IPTC:Keywords'][0]
      : ((tags?.['XMP:Subject']) ? tags['XMP:Subject'][0] : null) ?? undefined
    if (keywords) {
      tagArray.push(`-MWG:Keywords= -MWG:keywords="${keywords}"`)
      delete tags['IPTC:Keywords']
      delete tags['XMP:Subject']
    }
    /* eslint-enable no-nested-ternary */
    try {
      log('imageFile', imageFile)
      stats = await stat(imageFile)
      // log(stats)
      if (stats.isFile()) {
        Object.keys(tags).forEach((t) => {
          log(t, tags[t].join())
          tagArray.push(`-${t}="${tags[t].join()}"`)
        })
        exiftool = await exiftool.init(imageFile)
        exiftool.setOverwriteOriginal(true)
        log('setting new config path')
        await exiftool.setConfigPath(`${ctx.app.root}/config/exiftool.config`)
        log('tagArray: %o', tagArray)
        newCARs = await exiftool.writeMetadataToTag(tagArray)
        log('newCARs', newCARs)
        result = await exiftool.getMetadata('', null, '--ICC_Profile:all')
        response.metadata = result
        // response.modifiedFile = result[0]['File:FileName']
        response.modifiedFile = (await exiftool.getPath()).file
        log('result', response)
      }
    } catch (e) {
      error(`Failed to update requested image file: ${imageFile}`)
      error(e)
    }
    log('csrf token check passed')
    // const res = { fields: ctx.request.body }
    ctx.response.status = 200
    ctx.response.type = 'application/json; charset=utf-8'
    ctx.response.body = response ?? { huh: 'whut?' }
  }
})

router.post(
  'editLocation',
  '/editLocation',
  addIpToSession,
  processFormData,
  async (ctx) => {
    const log = exifLog.extend('POST-editLocation')
    const error = exifError.extend('POST-editLocation')
    const csrfTokenCookie = ctx.cookies.get('csrfToken')
    const csrfTokenSession = ctx.session.csrfToken
    const csrfTokenHidden = ctx.request.body.csrfTokenHidden[0]
    if (csrfTokenCookie === csrfTokenSession) log('cookie === session')
    if (csrfTokenSession === csrfTokenHidden) log('session === hidden')
    if (csrfTokenCookie === csrfTokenHidden) log('hidden === cookie')
    if (!doTokensMatch(ctx)) {
      error(`CSRF-Token mismatch: header:${csrfTokenCookie}`)
      error(`                     hidden:${csrfTokenHidden}`)
      error(`                    session:${csrfTokenSession}`)
      ctx.type = 'application/json; charset=utf-8'
      ctx.status = 401
      ctx.body = { error: 'csrf token mismatch' }
    } else {
      const [filename] = ctx.request.body.inspectedFilename ?? null
      const imageFile = path.resolve(`${ctx.app.root}/${INSPECTED}/${filename}`)
      const response = {}
      const tags = ctx.request.body
      let stats
      let exiftool = new Exiftool()
      let newLocation
      let result
      /* eslint-disable no-nested-ternary */
      const coordinates = {
        latitude: (tags?.['EXIF:GPSLatitude'])
          ? tags['EXIF:GPSLatitude'][0]
          : ((tags?.['XMP:GPSLatitude'])
            ? tags['XMP:GPSLatitude'][0]
            : null) ?? null,
        longitude: (tags?.['EXIF:GPSLongitude'])
          ? tags['EXIF:GPSLongitude'][0]
          : ((tags?.['XMP:GPSLongitude'])
            ? tags['XMP:GPSLongitude'][0]
            : null) ?? null,
        city: (tags?.['IPTC:City'])
          ? tags['IPTC:City'][0]
          : ((tags?.['XMP:City'])
            ? tags['XMP:City'][0]
            : ((tags?.['XMP:LocationShownCity'])
              ? tags['XMP:LocationShownCity'][0]
              : null)) ?? undefined,
        state: (tags?.['IPTC:Province-State'])
          ? tags['IPTC:Province-State'][0]
          : ((tags?.['XMP:State'])
            ? tags['XMP:State'][0]
            : ((tags?.['XMP:LocationShownCity'])
              ? tags['XMP:LocationShownCity'][0]
              : null)) ?? undefined,
        country: (tags?.['IPTC:Country-PrimaryLocationName'])
          ? tags['IPTC:Country-PrimaryLocationName'][0]
          : ((tags?.['XMP:Country'])
            ? tags['XMP:Country'][0]
            : ((tags?.['XMP:LocationShownCountryName'])
              ? tags['XMP:LocationShownCountryName'][0]
              : null)) ?? undefined,
        countryCode: (tags?.['IPTC:Country-PrimaryLocationCode'])
          ? tags['IPTC:Country-PrimaryLocationCode'][0]
          : ((tags?.['XMP:CountryCode'])
            ? tags['XMP:CountryCode'][0]
            : ((tags?.['XMP:LocationShownCountryCode'])
              ? tags['XMP:LocationShownCountryCode'][0]
              : null)) ?? undefined,
        location: (tags?.['IPTC:Sub-location'])
          ? tags['IPTC:Sub-location'][0]
          : ((tags?.['XMP:Location'])
            ? (tags['XMP:Location'][0])
            : null) ?? undefined,
      }
      /* eslint-enable no-nested-ternary */
      try {
        log('imageFile', imageFile)
        stats = await stat(imageFile)
        // log(stats)
        if (stats.isFile()) {
          log('init ', imageFile)
          exiftool = await exiftool.init(imageFile)
          const expandStructs = true
          exiftool.enableXMPStructTagOutput(expandStructs)
          exiftool.setGPSCoordinatesOutputFormat('+gps')
          exiftool.enableBinaryTagOutput(true)
          exiftool.setOverwriteOriginal(true)
          log('setting new config path')
          await exiftool.setConfigPath(`${ctx.app.root}/config/exiftool.config`)
          log('stripping initial location data')
          const stripLocationFirst = await exiftool.stripLocation()
          log('stripLocationFirst', stripLocationFirst)
          log('setting new location', newLocation)
          log('new coordinates', coordinates)
          newLocation = await exiftool.setLocation(coordinates)
          log('newLocation', newLocation)
          result = await exiftool.getMetadata('', null, '--ICC_Profile:all')
          log('result', result)
          response.modifiedFile = result[0]['File:FileName']
          response.metadata = result
        }
      } catch (e) {
        error(`Failed to update requested image file: ${imageFile}`)
        error(e)
      }
      log('csrf token check passed')
      // const res = { fields: ctx.request.body }
      // ctx.response.body = res.fields ?? { huh: 'whut?' }
      ctx.response.status = 200
      ctx.response.type = 'application/json; charset=utf-8'
      ctx.response.body = response ?? { huh: 'whut?' }
    }
  },
)

router.get('getReviewFile', '/review/:f', async (ctx) => {
  const log = exifLog.extend('GET-reviewFile')
  const error = exifError.extend('GET-reviewFile')
  const file = sanitize(ctx.params.f)
  const response = {}
  let reviewFile
  let reviewFilePath
  if (file === 'IPTC-PhotometadataRef-Std2021.1.jpg') {
    reviewFilePath = path.resolve(`${ctx.app.root}/public/i/${file}`)
  } else {
    reviewFilePath = path.resolve(`${ctx.app.root}/${INSPECTED}/${file}`)
  }
  log(`reviewFile:     ${reviewFile}`)
  log(`reviewFilePath: ${reviewFilePath}`)
  if (!file || file === '') {
    error('Missing required file name url parameter.')
    ctx.response.status = 401
  } else {
    try {
      const stats = await stat(reviewFilePath)
      log(stats)
    } catch (e) {
      error(`Missing file to review: ${reviewFilePath}`)
      const csrfToken = ulid()
      const locals = {}
      locals.metadata = JSON.stringify({
        status: 404,
        file,
        href: `${ctx.state.origin}/${INSPECTED}/${file}`,
      }, null, '\t')
      locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
      ctx.session.csrfToken = csrfToken
      ctx.cookies.set('csrfToken', csrfToken, { httpOnly: true, sameSite: 'strict' })
      locals.csrfToken = csrfToken
      locals.body = ctx.body
      locals.domain = ctx.state.origin
      locals.origin = `${ctx.state.origin}/`
      locals.flash = ctx.flash?.index ?? {}
      locals.title = `${ctx.app.site}: Review`
      locals.sessionUser = ctx.state.sessionUser
      locals.accessToken = ctx.state.searchJwtAccess
      locals.isAuthenticated = ctx.state.isAuthenticated
      // ctx.response.status = 200
      ctx.response.type = 'application/json; charset=utf-8'
      return ctx.render('index', locals)
    }
    let exiftool = new Exiftool()
    try {
      // run exif command here
      exiftool = await exiftool.init(reviewFilePath)
      const expandStructs = true
      exiftool.enableXMPStructTagOutput(expandStructs)
      exiftool.setGPSCoordinatesOutputFormat('+gps')
      exiftool.enableBinaryTagOutput(true)
      exiftool.setOverwriteOriginal(false)
      const newConfigPath = await exiftool.setConfigPath(
        `${ctx.app.root}/config/exiftool.config`,
      )
      log('exiftool config path set: %o', newConfigPath)
      const result = await exiftool.getMetadata(
        '',
        null,
        'All',
        '-Photoshop:PhotoshopThumbnail',
        '--ICC_Profile:all',
      )
      log('result', result)
      if (result.stdout && typeof result.stdout === 'string') {
        [response.metadata] = JSON.parse(result.stdout)
        delete response.metadata['File:Directory']
        response.metadata.SourceFile = `../${response.metadata.SourceFile
          .split('/')
          .slice(4)
          .join('/')}`
        response.error = response.metadata['ExifTool:Error']
        log(response)
      } else {
        response.metadata = result
      }
      response.href = `${ctx.state.origin}/inspected/${file}`
      response.inspectedFile = file
    } catch (e) {
      error(e)
      error(`Failed to run exif command on ${reviewFilePath}`)
      response.msg = `Failed to run exif command on ${reviewFilePath}`
      response.e = e
    }
  }
  const cleanResponse = removeServerDetails(response)
  const csrfToken = ulid()
  const locals = {}
  locals.metadata = JSON.stringify(cleanResponse, null, '\t')
  locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
  ctx.session.csrfToken = csrfToken
  ctx.cookies.set('csrfToken', csrfToken, { httpOnly: true, sameSite: 'strict' })
  locals.csrfToken = csrfToken
  locals.body = ctx.body
  locals.domain = ctx.state.origin
  locals.origin = `${ctx.state.origin}/`
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: Review`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  ctx.status = 200
  return ctx.render('index', locals)
})

router.get('getUnStickFile', '/unstick/:f', async (ctx) => {
  const log = exifLog.extend('GET-unstick')
  const error = exifError.extend('GET-unstick')
  const file = sanitize(ctx.params.f)
  const objectId = new ObjectId()
  let newFilePath
  const date = new Date()
  const geo = ctx.state.logEntry?.geos?.[0]
  const uploadDoc = {
    _id: objectId,
    date,
    ip: geo?.ip ?? null,
    geo,
    coords: {
      type: 'Point',
      // mongodb requires longitude, latitude order
      coordinates: [(geo?.coords?.[1] ?? 0), (geo?.coords?.[0] ?? 0)],
    },
    imageTempName: file,
    sanitizedFile: file,
    uploadedFile: 'Image file stuck in uploads dir',
    size: 'wait for it',
    inspectedFile: '',
  }
  if (!file || file === '') {
    error('Missing required file name url parameter.')
    ctx.response.status = 401
  } else {
    const newFilename = `${objectId}_`
      + `${date.toISOString().split('T')[0]}.`
      + `${file.slice(file.lastIndexOf('.') + 1)}`
    const stuckFilePath = `${ctx.app.root}/${UPLOADS}/${file}`
    log('new name for unsticking file:', newFilename)
    try {
      newFilePath = path.resolve(`${ctx.app.root}/${INSPECTED}/${newFilename}`)
      const isMoved = await rename(stuckFilePath, newFilePath)
      log(`${newFilePath} moved successfully?`, isMoved)
      uploadDoc.inspectedFile = newFilePath
    } catch (e) {
      error('Unsticking action failed')
      error(e)
      ctx.type = 'application/json; charset=utf-8'
      ctx.status = 200
      ctx.body = {
        error: 'Unsticking action failed.',
        written: false,
        file,
      }
    }
    try {
      log('saving unstuck file details to db.')
      log(uploadDoc)
      const db = ctx.state.mongodb.client.db()
      const collection = db.collection('images')
      const dbSaved = await collection.insertOne(uploadDoc)
      log(dbSaved)
    } catch (e) {
      error('failed to save unstuck file details to db.')
      error(e)
      ctx.type = 'application/json; charset=utf-8'
      ctx.status = 200
      ctx.body = {
        error: 'Saving unsticking action to db failed.',
        written: true,
        file: newFilename,
      }
    }
    ctx.redirect(`${ctx.state.origin}/review/${newFilename}`)
  }
})

router.get('getStuckFile', '/stuck/:f', async (ctx) => {
  const log = exifLog.extend('GET-stuckFile')
  const error = exifError.extend('GET-stuckFile')
  const file = sanitize(ctx.params.f)
  if (!file || file === '') {
    error('Missing required file name url parameter.')
    ctx.response.status = 401
  } else {
    let edittedFile
    const edittedFilePath = path.resolve(`${ctx.app.root}/${UPLOADS}/${file}`)
    try {
      log('get inspected file', edittedFilePath)
      edittedFile = await readFile(edittedFilePath)
      const { ext } = path.parse(edittedFilePath)
      const _original = file.match(
        /(?<name>.*)\.{1}(?<type>jpeg|jpg|png|heic|webp|gif)_original$/i,
      )
      let type
      if (_original?.groups?.type) {
        type = _original.groups.type
      } else {
        type = `image/${ext.slice(1)}`
      }
      ctx.response.status = 200
      ctx.response.type = type
      log(ctx.response.status, type, edittedFile)
      ctx.response.body = edittedFile
    } catch (e) {
      error(`Failed to open ${edittedFilePath} `)
      error(e)
      ctx.response.status = 404
    }
  }
})

router.get('getDeletedFile', '/unspected/:f', async (ctx) => {
  const log = exifLog.extend('GET-deletedFile')
  const error = exifError.extend('GET-deletedFile')
  const file = sanitize(ctx.params.f)
  if (!file || file === '') {
    error('Missing required file name url parameter.')
    ctx.response.status = 401
  } else {
    let edittedFile
    const edittedFilePath = path.resolve(`${ctx.app.root}/${DELETED}/${file}`)
    try {
      log('get inspected file', edittedFilePath)
      edittedFile = await readFile(edittedFilePath)
      const { ext } = path.parse(edittedFilePath)
      const _original = file.match(
        /(?<name>.*)\.{1}(?<type>jpeg|jpg|png|heic|webp|gif)_original$/i,
      )
      let type
      if (_original?.groups?.type) {
        type = _original.groups.type
      } else {
        type = `image/${ext.slice(1)}`
      }
      ctx.response.status = 200
      ctx.response.type = type
      log(ctx.response.status, type, edittedFile)
      ctx.response.body = edittedFile
    } catch (e) {
      error(`Failed to open ${edittedFilePath} `)
      error(e)
      ctx.response.status = 404
    }
  }
})

router.get('getEditedFile', '/inspected/:f', async (ctx) => {
  const log = exifLog.extend('GET-editedFile')
  const error = exifError.extend('GET-editedFile')
  const file = sanitize(ctx.params.f)
  if (!file || file === '') {
    error('Missing required file name url parameter.')
    ctx.response.status = 401
  } else {
    let edittedFile
    const edittedFilePath = path.resolve(`${ctx.app.root}/${INSPECTED}/${file}`)
    try {
      log('get inspected file', edittedFilePath)
      edittedFile = await readFile(edittedFilePath)
      const { ext } = path.parse(edittedFilePath)
      const _original = file.match(
        /(?<name>.*)\.{1}(?<type>jpeg|jpg|png|heic|webp|gif)_original$/i,
      )
      let type
      if (_original?.groups?.type) {
        type = _original.groups.type
      } else {
        type = `image/${ext.slice(1)}`
      }
      ctx.response.status = 200
      ctx.response.type = type
      log(ctx.response.status, type, edittedFile)
      ctx.response.body = edittedFile
    } catch (e) {
      error(`Failed to open ${edittedFilePath} `)
      error(e)
      ctx.response.status = 404
    }
  }
})

router.get('getXMPData', '/getxmpdata/:f', async (ctx) => {
  const log = exifLog.extend('GET-xmpData')
  const error = exifError.extend('GET-xmpData')
  const file = sanitize(ctx.params.f)
  if (!file || file === '') {
    error('Missing requried file name url parameter.')
    // ctx.response.status = 401
    ctx.redirect('/')
    ctx.body = 'Redirecting to index page.  Missing required file name url parameter.'
  } else {
    let downloadName
    // log(file)
    // log(/^(([0-9abcdefghjkmnpqrstvwxyz]{25}_)+)(?<goodpart>.*)$/i)
    const match = file.match(/^(([0-9abcdefghjkmnpqrstvwxyz]{25}_)+)(?<goodpart>.*)$/i)
    // log(match)
    if (match?.groups?.goodpart) {
      downloadName = `${(path.parse(match.groups.goodpart)).name}.xmp`
    } else {
      downloadName = 'adobe_presets.xmp'
    }
    let xmp
    let xmpPacket
    const inspectedFilePath = path.resolve(`${ctx.app.root}/${INSPECTED}/${file}`)
    // log(inspectedFilePath)
    try {
      xmp = await new Exiftool().init(inspectedFilePath)
      xmp.setOutputFormat('xml')
      // xmpResults = await xmp.getMetadata('', null, '-xmp:*')
      xmpPacket = await xmp.getXmpPacket()
      log('getting xmp data for adobe preset file. %o', xmpPacket)
      ctx.response.status = 200
      ctx.response.type = 'application/rdf+xml'
      ctx.attachment(downloadName)
      ctx.response.body = xmpPacket.xmp
    } catch (e) {
      error(`Failed to open ${inspectedFilePath}`)
      error(e)
      ctx.response.status = 404
    }
  }
}).get('getXMPData-missing-file', '/getxmpdata', async (ctx) => {
  ctx.redirect('/')
}).post('getXMPDAta-wrong-method-missing-file', '/getxmpdata', async (ctx) => {
  ctx.redirect('/')
})

router.get('redirectToPaginatedListUploaded', '/u', async (ctx) => {
  ctx.redirect('/u/1')
})

router.get('listStuckUploadedImages', '/u/:page', async (ctx) => {
  const log = exifLog.extend('liststuckuploadedimages')
  const error = exifError.extend('liststuckuploadedimages')
  ctx.state.sessionUser = ctx.state.sessionUser ?? {}
  if (!ctx.state.isAuthenticated) {
    ctx.redirect('/login')
  }
  log('Displaying list of images uploaded but somehow failed on the server.')
  log('URL parameters: ', ctx.params)
  const page = Number.parseInt((ctx.params?.page) ? ctx.params.page : 1, 10)
  let images
  let tool
  const dir = path.resolve(`${ctx.app.root}/${UPLOADS}`)
  let dirContents
  let dirSlice
  const pageLimit = 20
  let pageOffset
  let limit
  let fileString
  let cmd
  try {
    cmd = promisify(exec)
    const c = `ls -1t --ignore "Readme.md" ${dir}`
    log(c)
    const out = await cmd(c)
    dirContents = out.stdout.split('\n')
    if (dirContents.slice(-1)[0] === '') {
      dirContents = dirContents.slice(0, -1)
    }
    pageOffset = (page === 1) ? 0 : (page - 1) * pageLimit
    limit = pageOffset + pageLimit
    log(`pageLimit (${pageLimit}), pageOffset (${pageOffset}), limit (${limit})`)
    // log('dir contents', dirContents)
    dirSlice = dirContents.slice(pageOffset, limit)
    log(dirSlice)
    fileString = dirSlice.map((f) => `"${dir}/${f}"`).join(' ')
    // log(fileString.replaceAll(' ', '\n'))
  } catch (e) {
    error(`failed to list files in ${dir}`)
    error(e)
    fileString = dir
  }
  try {
    tool = new Exiftool()
    log('current value for exiftool exec() maxBuffer:', tool.getOutputBufferSize())
    // tool.setMaxBufferMultiplier(1000)
    // tool.setMaxBufferMultiplier(Infinity)
    const configPath = `${ctx.app.dirs.config}/exiftool.config`
    const raw = `/usr/local/bin/exiftool -config ${configPath} `
      + '-quiet -json --ext md -groupNames -b -dateFormat "%Y/%m/%d %H:%M:%S" '
      + '-File:Filename -File:MIMEType -File:FileSize -File:FileModifyDate -AllThumbs '
      + `-f ${fileString}`
    log(`raw exiftool cmd: ${raw}`)
    images = await tool.raw(raw)
    // log(images.slice(-1))
  } catch (e) {
    error('Failed to exiftool inspected images.')
    error(e)
  }

  const csrfToken = ulid()
  ctx.session.csrfToken = csrfToken
  ctx.cookies.set('csrfToken', csrfToken, { httpOnly: true, sameSite: 'strict' })
  const locals = {}
  locals.images = images || []
  locals.pageInfo = {
    page,
    pageOffset,
    limit,
    pageLimit,
  }
  locals.fileCount = dirContents.length || 0
  locals.perPage = pageLimit
  locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
  locals.csrfToken = csrfToken
  locals.domain = ctx.state.origin
  // locals.origin = ctx.request.href
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: List Uploaded Images`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  await ctx.render('listStuckUploadedImages', locals)
})

router.get('redirectToPaginatedListDeleted', '/d', async (ctx) => {
  ctx.redirect('/d/1')
})

router.get('listDeletedImages', '/d/:page', async (ctx) => {
  const log = exifLog.extend('listdeletedimages')
  const error = exifError.extend('listdeletedimages')
  ctx.state.sessionUser = ctx.state.sessionUser ?? {}
  if (!ctx.state.isAuthenticated) {
    ctx.redirect('/login')
  }
  log('Displaying list of deleted images on the server.')
  log('URL parameters: ', ctx.params)
  const page = Number.parseInt((ctx.params?.page) ? ctx.params.page : 1, 10)
  let images
  let tool
  const dir = path.resolve(`${ctx.app.root}/${DELETED}`)
  let dirContents
  let dirSlice
  const pageLimit = 20
  let pageOffset
  let limit
  let fileString
  let cmd
  try {
    cmd = promisify(exec)
    const c = `ls -1t --ignore "Readme.md" ${dir}`
    log(c)
    const out = await cmd(c)
    dirContents = out.stdout.split('\n')
    if (dirContents.slice(-1)[0] === '') {
      dirContents = dirContents.slice(0, -1)
    }
    pageOffset = (page === 1) ? 0 : (page - 1) * pageLimit
    limit = pageOffset + pageLimit
    log(`pageLimit (${pageLimit}), pageOffset (${pageOffset}), limit (${limit})`)
    // log('dir contents', dirContents)
    dirSlice = dirContents.slice(pageOffset, limit)
    // log(dirSlice)
    fileString = dirSlice.map((f) => `"${dir}/${f}"`).join(' ')
    // log(fileString.replaceAll(' ', '\n'))
  } catch (e) {
    error(`failed to list files in ${dir}`)
    error(e)
    fileString = dir
  }
  try {
    tool = new Exiftool()
    log('current value for exiftool exec() maxBuffer:', tool.getOutputBufferSize())
    // tool.setMaxBufferMultiplier(1000)
    // tool.setMaxBufferMultiplier(Infinity)
    const configPath = `${ctx.app.dirs.config}/exiftool.config`
    const raw = `/usr/local/bin/exiftool -config ${configPath} `
      + '-quiet -json --ext md -groupNames -b -dateFormat "%Y/%m/%d %H:%M:%S" '
      + '-File:Filename -File:MIMEType -File:FileSize -File:FileModifyDate -AllThumbs '
      + `-f ${fileString}`
    log(`raw exiftool cmd: ${raw}`)
    images = await tool.raw(raw)
    // log(images.slice(-1))
  } catch (e) {
    error('Failed to exiftool inspected images.')
    error(e)
  }

  const csrfToken = ulid()
  ctx.session.csrfToken = csrfToken
  ctx.cookies.set('csrfToken', csrfToken, { httpOnly: true, sameSite: 'strict' })
  const locals = {}
  locals.images = images || []
  locals.pageInfo = {
    page,
    pageOffset,
    limit,
    pageLimit,
  }
  locals.fileCount = dirContents.length || 0
  locals.perPage = pageLimit
  locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
  locals.csrfToken = csrfToken
  locals.domain = ctx.state.origin
  // locals.origin = ctx.request.href
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: List Uploaded Images`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  await ctx.render('listDeletedImages', locals)
})

router.get('redirectToPaginatedList', '/x', async (ctx) => {
  ctx.redirect('/x/1')
})

router.get('listInspectedImages', '/x/:page', async (ctx) => {
  const log = exifLog.extend('listinspectedimages')
  const error = exifLog.extend('listinspectedimages')
  ctx.state.sessionUser = ctx.state.sessionUser ?? {}
  if (!ctx.state.isAuthenticated) {
    ctx.redirect('/login')
  }
  log('Displaying list of images on the server.')
  log('URL parameters: ', ctx.params)
  const page = Number.parseInt((ctx.params?.page) ? ctx.params.page : 1, 10)
  let images
  let tool
  const dir = path.resolve(`${ctx.app.root}/${INSPECTED}`)
  let dirContents
  let dirSlice
  const pageLimit = 20
  let pageOffset
  let limit
  let fileString
  let cmd
  try {
    cmd = promisify(exec)
    const c = `ls -1t --ignore "Readme.md" ${dir}`
    log(c)
    const out = await cmd(c)
    dirContents = out.stdout.split('\n')
    pageOffset = (page === 1) ? 0 : (page - 1) * pageLimit
    limit = pageOffset + pageLimit
    log(`pageLimit (${pageLimit}), pageOffset (${pageOffset}), limit (${limit})`)
    dirSlice = dirContents.slice(pageOffset, limit)
    fileString = dirSlice.map((f) => `"${dir}/${f}"`).join(' ')
  } catch (e) {
    error(`failed to list files in ${dir}`)
    error(e)
    fileString = dir
  }
  try {
    tool = new Exiftool()
    log('current value for exiftool exec() maxBuffer:', tool.getOutputBufferSize())
    // tool.setMaxBufferMultiplier(1000)
    // tool.setMaxBufferMultiplier(Infinity)
    const configPath = `${ctx.app.dirs.config}/exiftool.config`
    const raw = `/usr/local/bin/exiftool -config ${configPath} `
      + '-quiet -json --ext md -groupNames -b -dateFormat "%Y/%m/%d %H:%M:%S" '
      + '-File:Filename -File:MIMEType -File:FileSize -File:FileModifyDate -AllThumbs '
      + `-f ${fileString}`
    log(`raw exiftool cmd: ${raw}`)
    images = await tool.raw(raw)
    // log('images: ', images)
    // if (images.length > 0) {
    //   images.sort((a, b) => {
    //    return new Date(b['File:FileModifyDate']) - new Date(a['File:FileModifyDate'])
    //  )
    // }
  } catch (e) {
    error('Failed to exiftool inspected images.')
    error(e)
  }

  const csrfToken = ulid()
  ctx.session.csrfToken = csrfToken
  ctx.cookies.set('csrfToken', csrfToken, { httpOnly: true, sameSite: 'strict' })
  const locals = {}
  locals.images = images || []
  locals.pageInfo = {
    page,
    pageOffset,
    limit,
    pageLimit,
  }
  locals.fileCount = dirContents.length || 0
  locals.perPage = pageLimit
  locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
  locals.csrfToken = csrfToken
  locals.domain = ctx.state.origin
  // locals.origin = ctx.request.href
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: List Uploaded Images`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  await ctx.render('listInspectedImages', locals)
})

router.delete(
  'deleteImage',
  '/delete/image/:file',
  addIpToSession,
  processFormData,
  async (ctx) => {
    const log = exifLog.extend('DELETE-deleteimage')
    const error = exifError.extend('DELETE-deleteimage')
    const csrfTokenCookie = ctx.cookies.get('csrfToken')
    const csrfTokenSession = ctx.session.csrfToken
    const csrfTokenHidden = ctx.request.body.csrfTokenHidden[0]
    if (csrfTokenCookie === csrfTokenSession) log('cookie === session')
    if (csrfTokenCookie === csrfTokenHidden) log('hidden === cookie')
    if (csrfTokenSession === csrfTokenHidden) log('session === hidden')
    if (!doTokensMatch(ctx)) {
      error(`CSRF-Token mismatch: header:${csrfTokenCookie}`)
      error(`                     hidden:${csrfTokenHidden}`)
      error(`                    session:${csrfTokenSession}`)
      ctx.type = 'application/json; charset=utf-8'
      ctx.status = 401
      ctx.body = { error: 'csrf token mismatch' }
    } else {
      log('csrf token check passed')
      const imageToDelete = path.resolve(`./${INSPECTED}`, ctx.params.file)
      const moveToDeleted = path.resolve(`./${DELETED}`, ctx.params.file)
      log(`imageToDelete: ${imageToDelete}`)
      let isDeleted
      try {
        // isDeleted = await rm(imageToDelete, { force: true })
        isDeleted = await rename(imageToDelete, moveToDeleted)
        log(`marking image as deleted in db: ${imageToDelete}`)
        const db = ctx.state.mongodb.client.db()
        const collection = db.collection('images')
        const filter = { inspectedFile: imageToDelete }
        const update = {
          $set:
          {
            deleted: true,
            deletedFile: moveToDeleted,
          },
        }
        log(filter, update)
        const _deleted = await collection.updateOne(filter, update)
        log('db delete result: ', _deleted)
        ctx.status = 200
        ctx.type = 'application/json; charset=utf-8'
        ctx.body = { status: 'ok', isDeleted }
      } catch (e) {
        error(`Failed to delete image: ${imageToDelete}`)
        error(e)
        ctx.status = 418
        ctx.type = 'application/json; charset=utf-8'
        ctx.body = { error: e.message }
      }
    }
  },
)

router.get('about', '/about', hasFlash, async (ctx) => {
  const log = exifLog.extend('about')
  // const error = exifError.extend('about')
  log('inside index router: /about')
  ctx.status = 200
  const locals = {}
  locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
  locals.domain = ctx.state.origin
  // locals.origin = ctx.request.href
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: Home`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  await ctx.render('about', locals)
})

// router.get('contact', '/contact', hasFlash, async (ctx) => {
//   const log = exifLog.extend('contact')
//   // const error = exifError.extend('contact')
//   log('inside index router: /contact')
//   ctx.status = 200
//   await ctx.render('contact', {
//     title: `${ctx.app.site}: Contact`,
//     sessionUser: ctx.state.sessionUser,
//     isAuthenticated: ctx.state.isAuthenticated,
//   })
// })
export { router as exifinspector }
