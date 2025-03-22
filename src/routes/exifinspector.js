/**
 * @summary Koa router for the main top-level pages.
 * @module @mattduffy/koa-stub
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/routes/exifinspector.js The router for the top level app URLs.
 */

import {
  rm, readFile, rename, stat, writeFile,
} from 'node:fs/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import Router from '@koa/router'
import { ulid } from 'ulid'
/* eslint-disable-next-line */
import { Exiftool } from '@mattduffy/exiftool'
/* eslint-disable-next-line */
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
/* eslint-disable-next-line no-unused-vars */
function sanitize(param) {
  // fill in with some effective input scrubbing logic
  return param
}
function sanitizeFilename(filename) {
  // Remove whitespace characters from filename.
  // Remove non-word characters from filename.
  /* eslint-disable-next-line */
  // const cleanName = filename.replace(/[\s!@#\$%&*\(\)|(%\d\d)](?!(\.\w{1,4}$))/g, '_')
  // const cleanName = filename.replaceAll(/[(\s?)!@#\$%&*\(\)]|(?<=%)\d{2}(?!(\.\D{1,4}$))/g, '_') // eslint-disable-line
  const cleanName = filename.replaceAll(/[(\s?)!@#\$%&*\(\)]|((?<=%)\d{2})(?!\.\D{2,5})/g, '_') // eslint-disable-line
  console.log(`Sanitizing filename ${filename} to ${cleanName}`)
  return cleanName
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
  locals.origin = ctx.request.href
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
    const image = ctx.request.files?.image_0?.[0] ?? null
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
    let inspectedName
    let urlToInspect = ctx.request.body?.url?.[0] ?? null
    const uploadDoc = {
      date: new Date(),
      location: ctx.state.logEntry,
    }
    if (urlToInspect !== null) {
      try {
        urlToInspect = new URL(ctx.request.body.url[0])
        log(urlToInspect);
        [uploadDoc.remoteUrl] = ctx.request.body.url
        const remoteFile = { url: urlToInspect }
        const remoteResponse = await get(urlToInspect)
        log(remoteResponse.statusCode)
        log(remoteResponse.statusMessage)
        log(remoteResponse.contentType)
        const filePath = path.parse(urlToInspect.pathname)
        const fileName = `${ulid()}_${filePath.base}`
        inspectedName = path.resolve(`${ctx.app.root}/inspected/${fileName}`)
        uploadDoc.inspectedFile = inspectedName
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
      if (image !== null) {
        log(`image size: ${image?.size}`)
        imageOriginalFilenameCleaned = sanitizeFilename(image.originalFilename)
        const prefix = image.newFilename.slice(0, image.newFilename.lastIndexOf('.'))
        imageSaved = path.resolve(`${ctx.app.root}/inspected/${prefix}_${imageOriginalFilenameCleaned}`)
        const isMoved = await rename(image.filepath, imageSaved)
        log(`${imageSaved} moved successfully? ${(isMoved === undefined)}`)
        response.inspectedFile = `${prefix}_${imageOriginalFilenameCleaned}`
        uploadDoc.uploadedFile = image.originalFilename
        uploadDoc.sanitizedFile = imageOriginalFilenameCleaned
        uploadDoc.inspectedFile = imageSaved
        images.push(imageSaved)
      }
    } catch (e) {
      error(`Failed to move ${image.filepath} to the ${imageSaved}.`)
      response.msg = `Failed to move ${image.filepath} to the inspected/ dir.`
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
        // response.modifiedFile = result[0]['File:FileorName']
        response.modifiedFile = (await exiftool.getPath()).file
        log(result)
      } else {
        // result = await exiftool.getMetadata('', exifShortcut, '-AllThunbs --ICC_Profile:all')
        result = await exiftool.getMetadata('', exifShortcut, 'All', '-Photoshop:PhotoshopThumbnail', '--ICC_Profile:all')
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
    const imageFile = path.resolve(`${ctx.app.root}/inspected/${filename}`)
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
    const description = (tags?.['IPTC:Caption-Abstract']) ? tags['IPTC:Caption-Abstract'][0]
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

router.post('editLocation', '/editLocation', addIpToSession, processFormData, async (ctx) => {
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
    const imageFile = path.resolve(`${ctx.app.root}/inspected/${filename}`)
    const response = {}
    const tags = ctx.request.body
    let stats
    let exiftool = new Exiftool()
    let newLocation
    let result
    /* eslint-disable no-nested-ternary */
    const coordinates = {
      latitude: (tags?.['EXIF:GPSLatitude']) ? tags['EXIF:GPSLatitude'][0]
        : ((tags?.['XMP:GPSLatitude']) ? tags['XMP:GPSLatitude'][0]
          : null) ?? null,
      longitude: (tags?.['EXIF:GPSLongitude']) ? tags['EXIF:GPSLongitude'][0]
        : ((tags?.['XMP:GPSLongitude']) ? tags['XMP:GPSLongitude'][0]
          : null) ?? null,
      city: (tags?.['IPTC:City']) ? tags['IPTC:City'][0]
        : ((tags?.['XMP:City']) ? tags['XMP:City'][0]
          : ((tags?.['XMP:LocationShownCity']) ? tags['XMP:LocationShownCity'][0]
            : null)) ?? undefined,
      state: (tags?.['IPTC:Province-State']) ? tags['IPTC:Province-State'][0]
        : ((tags?.['XMP:State']) ? tags['XMP:State'][0]
          : ((tags?.['XMP:LocationShownCity']) ? tags['XMP:LocationShownCity'][0]
            : null)) ?? undefined,
      country: (tags?.['IPTC:Country-PrimaryLocationName']) ? tags['IPTC:Country-PrimaryLocationName'][0]
        : ((tags?.['XMP:Country']) ? tags['XMP:Country'][0]
          : ((tags?.['XMP:LocationShownCountryName']) ? tags['XMP:LocationShownCountryName'][0]
            : null)) ?? undefined,
      countryCode: (tags?.['IPTC:Country-PrimaryLocationCode']) ? tags['IPTC:Country-PrimaryLocationCode'][0]
        : ((tags?.['XMP:CountryCode']) ? tags['XMP:CountryCode'][0]
          : ((tags?.['XMP:LocationShownCountryCode']) ? tags['XMP:LocationShownCountryCode'][0]
            : null)) ?? undefined,
      location: (tags?.['IPTC:Sub-location']) ? tags['IPTC:Sub-location'][0]
        : ((tags?.['XMP:Location']) ? (tags['XMP:Location'][0])
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
})

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
    reviewFilePath = path.resolve(`${ctx.app.root}/inspected/${file}`)
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
      locals.metadata = JSON.stringify({ status: 404, file, href: `${ctx.state.origin}/inspected/${file}` }, null, '\t')
      locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
      ctx.session.csrfToken = csrfToken
      ctx.cookies.set('csrfToken', csrfToken, { httpOnly: true, sameSite: 'strict' })
      locals.csrfToken = csrfToken
      locals.body = ctx.body
      locals.domain = ctx.state.origin
      locals.origin = `${ctx.request.origin}/`
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
      const newConfigPath = await exiftool.setConfigPath(`${ctx.app.root}/config/exiftool.config`)
      // log(`exiftool config path set: ${result.toString()}`)
      log('exiftool config path set: %o', newConfigPath)
      const result = await exiftool.getMetadata('', null, 'All', '-Photoshop:PhotoshopThumbnail', '--ICC_Profile:all')
      response.metadata = result
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
  locals.origin = `${ctx.request.origin}/`
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: Review`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  ctx.status = 200
  return ctx.render('index', locals)
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
    const edittedFilePath = path.resolve(`${ctx.app.root}/inspected/${file}`)
    try {
      log(edittedFilePath)
      edittedFile = await readFile(edittedFilePath)
      const { ext } = path.parse(edittedFilePath)
      const _original = file.match(/(?<name>.*)\.{1}(?<type>jpeg|jpg|png|heic|webp|gif)_original$/i)
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
    const inspectedFilePath = path.resolve(`${ctx.app.root}/inspected/${file}`)
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

router.get('redirectToPaginatedList', '/x', async (ctx) => {
  ctx.redirect('/x/1')
})

router.get('listUploadedImages', '/x/:page', async (ctx) => {
  const log = exifLog.extend('listuploadedimages')
  const error = exifLog.extend('listuploadedimages')
  ctx.state.sessionUser = ctx.state.sessionUser ?? {}
  if (!ctx.state.isAuthenticated) {
    ctx.redirect('/')
  }
  log('Displaying list of images on the server.')
  log('URL parameters: ', ctx.params)
  const page = Number.parseInt((ctx.params?.page) ? ctx.params.page : 1, 10)
  let images
  let tool
  const dir = path.resolve(`${ctx.app.root}/inspected`)
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
    /*
     * page = 0,                  page = 1,                  page = 2,                  page = 3,                  page = 4
     * pageOffset = 0 * 50 = 0    pageOffset = 1 * 50 = 50   pageOffset = 2 * 50 = 100  pageOffset = 3 * 50 = 150  pageOffset = 4 * 50 = 200
     *     limit = 0 + 50 = 50       limit = 50 + 50 = 100      limit = 100 + 50 = 150     limit = 150 + 50 = 200     limit = 200 + 50 = 250
     */
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
    const configPath = `${ctx.app.dirs.config}/exiftool.config`
    // const raw = `/usr/local/bin/exiftool -config ${configPath} -quiet -json --ext md -groupNames -b -dateFormat %s -File:Filename -File:MIMEType -File:FileModifyDate -AllThumbs -f ${dir}`
    // const raw = `/usr/local/bin/exiftool -config ${configPath} -quiet -json --ext md -groupNames -b -dateFormat "%Y/%m/%d %H:%M:%S" -File:Filename -File:MIMEType -File:FileModifyDate -AllThumbs -f ${dir}`
    const raw = `/usr/local/bin/exiftool -config ${configPath} -quiet -json --ext md -groupNames -b -dateFormat "%Y/%m/%d %H:%M:%S" -File:Filename -File:MIMEType -File:FileSize -File:FileModifyDate -AllThumbs -f ${fileString}`
    log(`raw exiftool cmd: ${raw}`)
    images = await tool.raw(raw)
    log('images: ', images)
    // if (images.length > 0) {
    //   images.sort((a, b) => new Date(b['File:FileModifyDate']) - new Date(a['File:FileModifyDate']))
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
  locals.origin = ctx.request.href
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: List Uploaded Images`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  await ctx.render('listUploadedImages', locals)
})

router.delete('deleteImage', '/delete/image/:file', addIpToSession, processFormData, async (ctx) => {
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
    const imageToDelete = path.resolve('./inspected', ctx.params.file)
    log(`imageToDelete: ${imageToDelete}`)
    let isDeleted
    try {
      isDeleted = await rm(imageToDelete, { force: true })
      log(`marking image as deleted in db: ${imageToDelete}`)
      const db = ctx.state.mongodb.client.db()
      const collection = db.collection('images')
      const filter = { inspectedFile: imageToDelete }
      const update = { $set: { deleted: true } }
      log(filter, update)
      const _deleted = await collection.updateOne(filter, update)
      log('result: ', _deleted)
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
})

router.get('about', '/about', hasFlash, async (ctx) => {
  const log = exifLog.extend('about')
  // const error = exifError.extend('about')
  log('inside index router: /about')
  ctx.status = 200
  const locals = {}
  locals.structuredData = JSON.stringify(ctx.state.structuredData, null, '\t')
  locals.domain = ctx.state.origin
  locals.origin = ctx.request.href
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
