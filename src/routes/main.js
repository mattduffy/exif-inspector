/**
 * @summary Koa router for the main top-level pages.
 * @module @mattduffy/koa-stub
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/routes/main.js The router for the top level app URLs.
 */

import {
  readFile, rename, stat, writeFile,
} from 'node:fs/promises'
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
    const cleanResponse = removeServerDetails(response)

    ctx.type = 'application/json; charset=utf-8'
    ctx.status = 200
    // ctx.body = response
    ctx.body = cleanResponse
  }
})

router.post('editCAR', '/editCAR', async (ctx) => {
  const log = mainLog.extend('POST-editCAR')
  const error = mainError.extend('POST-editCAR')
  const opts = {
    encoding: 'utf-8',
    uploadDir: ctx.app.dirs.private.uploads,
    keepExtensions: true,
    multipart: true,
  }
  log(opts)
  const form = formidable(opts)
  await new Promise((resolve, reject) => {
    form.parse(ctx.req, (err, fields) => {
      if (err) {
        error('There was a problem parsing the multipart form data.')
        error(err)
        reject(err)
        return
      }
      log('Multipart form data was successfully parsed.')
      ctx.request.body = fields
      // log(fields)
      resolve()
    })
  })
  const csrfTokenCookie = ctx.cookies.get('csrfToken')
  const csrfTokenSession = ctx.session.csrfToken
  const csrfTokenHidden = ctx.request.body.csrfTokenHidden[0]
  if (csrfTokenCookie === csrfTokenSession) log('cookie === session')
  if (csrfTokenSession === csrfTokenHidden) log('session === hidden')
  if (csrfTokenCookie === csrfTokenHidden) log('hidden === cookie')
  if (!(csrfTokenCookie === csrfTokenSession && csrfTokenSession === csrfTokenHidden)) {
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

router.post('editLocation', '/editLocation', async (ctx) => {
  const log = mainLog.extend('POST-editLocation')
  const error = mainError.extend('POST-editLocation')
  const opts = {
    encoding: 'utf-8',
    uploadDir: ctx.app.dirs.private.uploads,
    keepExtensions: true,
    multipart: true,
  }
  log(opts)
  const form = formidable(opts)
  await new Promise((resolve, reject) => {
    form.parse(ctx.req, (err, fields) => {
      if (err) {
        error('There was a problem parsing the multipart form data.')
        error(err)
        reject(err)
        return
      }
      log('Multipart form data was successfully parsed.')
      ctx.request.body = fields
      log(fields)
      resolve()
    })
  })
  const csrfTokenCookie = ctx.cookies.get('csrfToken')
  const csrfTokenSession = ctx.session.csrfToken
  const csrfTokenHidden = ctx.request.body.csrfTokenHidden[0]
  if (csrfTokenCookie === csrfTokenSession) log('cookie === session')
  if (csrfTokenSession === csrfTokenHidden) log('session === hidden')
  if (csrfTokenCookie === csrfTokenHidden) log('hidden === cookie')
  if (!(csrfTokenCookie === csrfTokenSession && csrfTokenSession === csrfTokenHidden)) {
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

router.get('getEditedFile', '/inspected/:f', async (ctx) => {
  const log = mainLog.extend('GET-editedFile')
  const error = mainError.extend('GET-editedFile')
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

router.get('getXMPData', '/getxmpdata/:f', async (ctx) => {
  const log = mainLog.extend('GET-xmpData')
  const error = mainError.extend('GET-xmpData')
  const file = sanitize(ctx.params.f)
  if (!file || file === '') {
    error('Missing requried file name url parameter.')
    ctx.response.status = 401
  } else {
    let downloadName
    const match = file.match(/^(([0-9abcdefghjkmnpqrstvwxyz]{25}_)+)(?<goodpart>.*)$/ig)
    if (match?.groups?.goodpart) {
      downloadName = `${(path.parse(match.groups.goodpart)).name}.xmp`
    } else {
      downloadName = 'adobe_presets.xmp'
    }
    let xmp
    let xmpPacket
    const inspectedFilePath = path.resolve(`${ctx.app.root}/inspected/${file}`)
    log(inspectedFilePath)
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
})

router.get('about', '/about', hasFlash, async (ctx) => {
  const log = mainLog.extend('about')
  // const error = mainError.extend('about')
  log('inside index router: /about')
  ctx.status = 200
  const locals = {}
  locals.origin = ctx.request.href
  locals.flash = ctx.flash?.index ?? {}
  locals.title = `${ctx.app.site}: Home`
  locals.sessionUser = ctx.state.sessionUser
  locals.accessToken = ctx.state.searchJwtAccess
  locals.isAuthenticated = ctx.state.isAuthenticated
  await ctx.render('about', locals)
})

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
