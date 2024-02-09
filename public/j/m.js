window.cartags = [
  { tag: '', value: '' },

  { tag: 'EXIF:Artist', value: '' },
  { tag: 'IPTC:By-line', value: '' },
  { tag: 'XMP:Creator', value: '' },

  { tag: 'XMP:ArtworkCreator', value: '' },
  { tag: 'XMP:ArtworkCreatorID', value: '' },
  { tag: 'XMP:AuthorsPosition', value: '' },

  { tag: 'XMP:Credit', value: '' },
  { tag: 'IPTC:Credit', value: '' },
  { tag: 'XMP:Source', value: '' },
  { tag: 'IPTC:Source', value: '' },

  { tag: 'IPTC:Writer-Editor', value: '' },
  { tag: 'XMP:CaptionWriter', value: '' },
  { tag: 'IPTC:By-lineTitle', value: '' },

  { tag: 'IPTC:Headline', value: '' },
  { tag: 'XMP:Headline', value: '' },

  { tag: 'IPTC:ObjectName', value: '' },
  { tag: 'XMP:Title', value: '' },
  { tag: 'XMP:ArtworkTitle', value: '' },

  { tag: 'IPTC:Caption-Abstract', value: '' },
  { tag: 'EXIF:ImageDescription', value: '' },
  { tag: 'XMP:Description', value: '' },

  { tag: 'IPTC:Keywords', value: '' },
  { tag: 'XMP:Subject', value: '' },

  { tag: 'EXIF:Copyright', value: '' },
  { tag: 'IPTC:CopyrightNotice', value: '' },
  { tag: 'XMP:Rights', value: '' },
  { tag: 'XMP:CopyrightOwnerID', value: '' },
  { tag: 'XMP:CopyrightOwnerName', value: '' },
  { tag: 'XMP:ArtworkCopyrightNotice', value: '' },
  { tag: 'XMP:ArtworkCopyrightOwnerID', value: '' },
  { tag: 'XMP:ArtworkCopyrightOwnerName', value: '' },
  { tag: 'XMP:WebStatement', value: '' },
  { tag: 'XMP:LicensorURL', value: '' },
]
window.locationtags = [
  { tag: '', value: '' },
  //
  { tag: 'EXIF:GPSLatitude', value: '' },
  { tag: 'EXIF:GPSLatitudeRef', value: '' },
  { tag: 'EXIF:GPSLongitude', value: '' },
  { tag: 'EXIF:GPSLongitudeRef', value: '' },
  { tag: 'EXIF:GPSAltitude', value: '' },
  { tag: 'EXIF:GPSAltitudeRef', value: '' },
  { tag: 'EXIF:GPSSpeed', value: '' },
  { tag: 'EXIF:GPSSpeedRef', value: '' },
  { tag: 'EXIF:GPSImgDirection', value: '' },
  { tag: 'EXIF:GPSImgDirectionRef', value: '' },
  { tag: 'EXIF:GPSDestBearing', value: '' },
  { tag: 'EXIF:GPSDestBearingRef', value: '' },
  { tag: 'EXIF:GPSHPositioningError', value: '' },

  { tag: 'Composite:GPSPosition', value: '', disabled: true },
  { tag: 'Composite:GPSLatitude', value: '', disabled: true },
  { tag: 'Composite:GPSLongitude', value: '', disabled: true },
  { tag: 'Composite:GPSAltitude', value: '', disabled: true },

  // { tag: 'IPTC:Sub-location', value: '', disabled: true },
  { tag: 'IPTC:City', value: '' },
  { tag: 'IPTC:Province-State', value: '' },
  { tag: 'IPTC:Country-PrimaryLocationName', value: '' },
  { tag: 'IPTC:Country-PrimaryLocationCode', value: '' },

  { tag: 'XMP:LocationShown', value: '', disabled: true },
  { tag: 'XMP:LocationShownGPSLatitude', value: '', disabled: true },
  { tag: 'XMP:LocationShownGPSLongitude', value: '', disabled: true },
  { tag: 'XMP:LocationShownGPSAltitude', value: '', disabled: true },
  { tag: 'XMP:LocationCreated', value: '', disabled: true },
  { tag: 'XMP:LocationCreatedGPSLatitude', value: '', disabled: true },
  { tag: 'XMP:LocationCreatedGPSLongitude', value: '', disabled: true },
  { tag: 'XMP:LocationCreatedGPSAltitude', value: '', disabled: true },

  { tag: 'XMP:Location', value: '', disabled: true },
  { tag: 'XMP:City', value: '', disabled: true },
  { tag: 'XMP:Country', value: '', disabled: true },
  { tag: 'XMP:CountryCode', value: '', disabled: true },
]
const form = document.forms[0]
const fileElement = form.image_0Id
const submitButton = form.submit_Id
const dragzone = document.querySelector('div#dragzone')
const infozone = document.querySelector('div#infozone')
// const metazone = document.querySelector('div#metazone')
const mapzone = document.querySelector('div#mapzone')
const formData = new FormData()
function isCARTag(tag) {
  let found
  window.cartags.some((t, i) => {
    // console.log(`cartags[${i}]${t.tag} ?=? ${tag}`)
    if (t?.tag.toLowerCase() === tag.toLowerCase()) {
      found = i
      return i
    }
    found = false
    return false
  })
  return found
}
function isLocationTag(tag) {
  // return window.locationtags.includes(tag)
  let found
  window.locationtags.some((t, i) => {
    if (t?.tag.toLowerCase() === tag.toLowerCase()) {
      found = i
      return i
    }
    found = false
    return false
  })
  return found
}
function hasLocationTags(meta) {
  let hasCoords = false
  if (meta['EXIF:GPSLongitude'] && meta['EXIF:GPSLatitude']) {
    hasCoords = 'EXIF'
  } else if (meta['Composite:GPSPosition']) {
    hasCoords = 'Composite'
  } else if (meta['XMP:LocationShownGPSLatitude'] && meta['XMP:LocationShownGPSLongitude']) {
    hasCoords = 'XMP'
  } else if (meta['XMP:LocationCreatedGPSLatitude'] && meta['XMP:LocationCreatedGPSLongitude']) {
    hasCoords = 'XMP'
  } else if (meta['XMP:LocationShown']?.[0]?.GPSLatitude && meta['XMP:LocationShown']?.[0]?.GPSLongitude) {
    hasCoords = 'XMP-struct'
  } else if (meta['XMP:LocationCreated']?.[0]?.GPSLatitude && meta['XMP:LocationCreated']?.[0]?.GPSLongitude) {
    hasCoords = 'XMP-struct'
  } else {
    hasCoords = false
  }
  return hasCoords
}
function getLocationCoordinates(type, meta) {
  let lat
  let lon
  let NS
  let EW
  let tag = null
  if (type === 'EXIF') {
    lat = parseFloat(meta['EXIF:GPSLatitude'])
    NS = meta['EXIF:GPSLatitudeRef']
    if (/south/i.test(NS)) lat *= (-1)
    lon = parseFloat(meta['EXIF:GPSLongitude'])
    EW = meta['EXIF:GPSLongitudeRef']
    if (/west/i.test(EW)) lon *= (-1)
    tag = 'EXIF GPS'
  } else if (type === 'Composite') {
    const [_lat, _lon] = meta['Composite:GPSPosition'].split(', ');
    [lat, NS] = _lat.split(' ')
    lat = parseFloat(lat)
    if (/s/i.test(NS)) lat *= (-1);
    [lon, EW] = _lon.split(' ')
    lon = parseFloat(lon)
    if (/w/i.test(EW)) lon *= (-1)
    tag = 'Composite GPS'
  } else if (type === 'XMP') {
    lat = parseFloat(meta['XMP:LocationShownGPSLatitude'])
    NS = meta['EXIF:GPSLatitudeRef']
    if (/south/i.test(NS)) lat *= (-1)
    lon = parseFloat(meta['XMP:LocationShownGPSLongitude'])
    EW = meta['EXIF:GPSLongitudeRef']
    if (/west/i.test(EW)) lon *= (-1)
    tag = 'XMP Location Shown'
  } else if (type === 'XMP-struct') {
    lat = parseFloat(meta['XMP:LocationShown']?.[0]?.GPSLatitude);
    [NS] = meta['XMP:LocationShown']?.[0]?.GPSLatitude.match(/[NS]/i) ?? ''
    if (/s/i.test(NS)) lat *= (-1)
    lon = parseFloat(meta['XMP:LocationShown']?.[0]?.GPSLongitude);
    [EW] = meta['XMP:LocationShown']?.[0]?.GPSLongitude.match(/[EW]/i) ?? ''
    if (/w/i.test(EW)) lon *= (-1)
  } else {
    lat = 0
    lon = 0
  }
  window.lat = lat
  window.lon = lon
  window.NS = NS
  window.EW = EW
  return [lat, lon, NS, EW, tag]
}
function normalizeCoordinateTags() {
  // Prefer exif coords if present, else xmp
  const dl = document.querySelector('dl#locationDL')
  const exifLat = dl.querySelector(':scope input[name="EXIF:GPSLatitude"]')
  const exifLon = dl.querySelector(':scope input[name="EXIF:GPSLongitude"]')
  const xmpLocationShown = dl.querySelector(':scope input[name="XMP:LocationShown"]')
  const xmpLocationCreated = dl.querySelector(':scope input[name="XMP:LocationCreated"]')
  const xmpLocationShownLatLon = dl.querySelectorAll(':scope input[name^="XMP:LocationShown:LatLon"]')
  const xmpLocationCreatedLatLon = dl.querySelectorAll(':scope input[name^="XMP:LocationCreated:LatLon"]')
  const xmpShownLat = dl.querySelector(':scope input[name^="XMP:LocationShown:GPSLat"]')
  const xmpShownLon = dl.querySelector(':scope input[name^="XMP:LocationShown:GPSLon"]')
  const xmpCreatedLat = dl.querySelector(':scope input[name^="XMP:LocationCreated:GPSLat"]')
  const xmpCreatedLon = dl.querySelector(':scope input[name^="XMP:LcoationCreated:GPSLon"]')
  if (exifLat !== null) {
    exifLat.disabled = false
    exifLon.disabled = false
    if (xmpShownLat !== null) xmpShownLat.disabled = true
    if (xmpShownLon !== null) xmpShownLon.disabled = true
    if (xmpCreatedLat !== null) xmpCreatedLat.disabled = true
    if (xmpCreatedLon !== null) xmpCreatedLon.disabled = true
    if (xmpLocationShownLatLon !== null) xmpLocationShownLatLon.disabled = true
    if (xmpLocationCreatedLatLon !== null) xmpLocationCreatedLatLon.disabled = true
  } else {
    if (xmpLocationShown !== null) {
      xmpLocationShown.disabled = false
      if (xmpLocationCreated !== null) xmpLocationCreated.disabled = false
    }
    if (xmpLocationShownLatLon.length > 0) {
      xmpLocationShownLatLon.forEach((n) => {
        /* eslint-disable-next-line */
        n.disabled = false
      })
    }
    if (xmpLocationCreatedLatLon.length > 0) {
      xmpLocationCreatedLatLon.forEach((n) => {
        /* eslint-disable-next-line */
        n.disabled = false
      })
    }
    if (xmpShownLat !== null) {
      xmpShownLat.disabled = false
      if (xmpShownLon !== null) xmpShownLon.disabled = false
      if (xmpCreatedLat !== null) xmpCreatedLat.disabled = true
      if (xmpCreatedLon !== null) xmpCreatedLon.disabled = true
    }
  }
}
function tagListDiv(tag) {
  if (tag === undefined || tag === null || tag === '') {
    return false
  }
  // console.log(`div#${tag}`)
  let div = document.querySelector(`div#${tag}`)
  /* eslint-disable-next-line */
  if (!!!div) {
    div = document.createElement('div')
    div.id = tag
    div.appendChild(document.createElement('dl'))
    document.querySelector('section#metadataSection').appendChild(div)
  } else {
    let dl = div.querySelector(':scope > dl')
    /* eslint-disable-next-line */
    if (!!!dl) {
      // console.log(`creating dl for ${tag}`)
      dl = document.createElement('dl')
      div.appendChild(dl)
    }
    // div.classList.remove('hidden')
  }
  // console.log(`returning div: ${div}`)
  return div
}
function addPointsToMap(points) {
  // console.log(points)
  const annotations = []
  if (Array.isArray(points)) {
    points.forEach((point) => {
      const marker = new window.mapkit.Coordinate(point.lat, point.lon)
      annotations.push(new window.mapkit.MarkerAnnotation(marker, { title: point.tag }))
    })
  } else {
    const marker = new window.mapkit.Coordinate(points.lat, points.lon)
    annotations.push(new window.mapkit.MarkerAnnotation(marker, { title: points.tag }))
  }
  window.map.showItems(annotations)
}
function convertFromPolarToScalar(coord) {
  const x = coord.match(/(?<n>\d{1,3}\.?\d{0,9}) (?<c>[NSEW])/i)
  let n = parseFloat(x.groups.n)
  if (x.groups.c.toLowerCase() === 's' || x.groups.c.toLowerCase() === 'w') {
    n *= (-1)
  }
  console.log(coord, n)
  return n
}
async function setupMapKitJs() {
  const tokenOpts = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${window.access}`,
    },
  }
  const request = new Request(`${origin}/mapkit/getToken`, tokenOpts)
  const response = await fetch(request)
  console.log(response.status)
  const { tokenID } = await response.json()
  if (!window.mapkit || window.mapkit.loadedLibraries.length === 0) {
    // mapkit.core.js or the libraries are not loaded yet.
    // Set up the callback and wait for it to be called.
    await new Promise((resolve) => { window.initMapKit = resolve })
    // Clean up
    delete window.initMapKit
  }
  window.mapkit.init({
    authorizationCallback: (done) => {
      done(tokenID)
    },
  })
}
async function main(lat, lon, tag) {
  if (lat === null || lon === null) {
    console.info('lat or lon (or both) are null, can\'t display map.')
  } else {
    await setupMapKitJs()
    const CAMERA_ALT = 5000
    const opts = {
      mapType: window.mapkit.Map.MapTypes.Hybrid,
      loadPriority: window.mapkit.Map.LoadPriorities.PointsOfInterest,
      visibleMapRect: new window.mapkit.MapRect(0, 0, 1, 1),
      showsCompass: window.mapkit.FeatureVisibility.Visible,
      showsScale: window.mapkit.FeatureVisibility.Visible,
      showsZoomControl: true,
      showsPointsOfInterest: true,
      showsMapTypeControl: true,
      isZoomEnabled: true,
      isRotationEnabled: true,
      isScrollEnabled: true,
    }
    window.map = new window.mapkit.Map(mapzone, opts)
    window.map.cameraDistance = CAMERA_ALT
    const marker = new window.mapkit.Coordinate(lat, lon)
    const annotation = new window.mapkit.MarkerAnnotation(marker, { title: tag })
    window.map.showItems([annotation])
  }
}
if (window.navigator.maxTouchPoints === 0) {
  dragzone.addEventListener('click', (e) => {
    console.log('dragzone click event target: ', e)
    // e.stopPropagation()
    // e.preventDefault()
    if (e.target.tagName === 'DIV') {
      fileElement.click()
    }
  })
} else {
  console.log('so many touch points')
  fileElement.style.display = 'visible'
}

dragzone.addEventListener('dragenter', (e) => {
  // e.preventDefault()
  e.stopPropagation();
  // e.target.classList.add('dragTarget')
  (document.querySelector('#filesId')).classList.add('dragTarget')
  console.log('entering the drag zone')
})
dragzone.addEventListener('dragleave', (e) => {
  // e.preventDefault()
  e.stopPropagation();
  // e.target.classList.remove('dragTarget')
  (document.querySelector('#filesId')).classList.remove('dragTarget')
  console.log('leaving drag zone.')
})
dragzone.addEventListener('dragover', (e) => {
  e.preventDefault()
  // console.log(e)
})
dragzone.addEventListener('drop', (e) => {
  e.preventDefault()
  e.stopPropagation();
  (document.querySelector('#filesId')).classList.remove('dragTarget')
  // e.target.classList.remove('dragTarget')
  const fileInput = form.image_0Id
  fileInput.files = e.dataTransfer.files
  // const files = e.dataTransfer.files
  console.log(fileInput.files[0])
  setFileInfo(fileInput.files[0])
})
fileElement.addEventListener('change', (e) => {
  e.preventDefault()
  e.stopPropagation()
  console.log('fileElement change: ', e)
  setFileInfo(e.target.files[0])
})
submitButton.addEventListener('click', (e) => {
  e.preventDefault()
  e.stopPropagation()
  if (form.url.value === '') {
    form.url.focus()
    return
  }
  setFileInfo()
})
async function setFileInfo(file = null) {
  formData.append('csrfTokenHidden', form['csrf-token'].value)
  formData.append('tagSet', form.tagSet.value)
  infozone.classList.remove('hidden')
  // metazone.classList.remove('hidden')
  if (file !== null) {
    // metazone.innerHTML = ''
    if (infozone.contains(document.querySelector('ul#fileInfo'))) {
      infozone.removeChild(document.querySelector('ul#fileInfo'))
    }
    const info = document.createElement('dl')
    info.id = 'fileInfo'
    const name = document.createElement('dt')
    name.innerText = file.name
    const size = document.createElement('dt')
    size.innerText = `${Math.round(file.size / 1024)} KB`
    const type = document.createElement('dt')
    type.innerText = file.type
    info.appendChild(name)
    info.appendChild(type)
    info.appendChild(size)
    const img = document.createElement('dd')
    if (/heic$/i.test(file.type)) {
      // chrome doesn't natively display .HEIC image format
      img.appendChild(document.createTextNode('HEIC image format is tough to display.'))
    } else {
      const preview = document.createElement('img')
      preview.classList.add('smallImgPreview')
      img.appendChild(preview)
      const fileReader = new window.FileReader()
      fileReader.addEventListener('load', (e) => {
        preview.src = e.target.result
      })
      fileReader.readAsDataURL(file)
    }
    info.appendChild(img)
    infozone.appendChild(info)
    if (form.image_0.files.length > 0) {
      formData.append('image_0', file)
    }
  // } else {
  }
  if (form.url.value !== '') {
    formData.append('url', form.url.value)
    const info = document.createElement('dl')
    info.id = 'fileInfo'
    const name = document.createElement('dt')
    name.innerText = form.url.value
    info.appendChild(name)
    const img = document.createElement('dd')
    const remoteThumbnail = document.createElement('img')
    remoteThumbnail.classList.add('smallImgPreview')
    remoteThumbnail.src = form.url.value
    img.appendChild(remoteThumbnail)
    info.appendChild(img)
    infozone.appendChild(info)
  }
  // }
  console.log(`tagSet: ${formData.get('tagSet')}`)
  console.log(`image_0: ${formData.get('image_0')}`)
  console.log(`url: ${formData.get('url')}`)
  try {
    await send(formData)
  } catch (e) {
    console.warn('something caused the send method to fail')
    console.error(e)
  }
}
let imgMetadata
let tags
async function send(data) {
  // let accessToken = '<%= accessToken %>'
  const opts = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${window.access}`,
    },
    body: data,
  }
  console.log(opts)
  const url = new window.URL(`${origin}/upload`)
  console.log(url.toString())
  const request = new Request(url, opts)
  console.log(request)
  const response = await fetch(request, { credentials: 'same-origin' })
  if (response.status === 200) {
    const results = await response.json()
    console.log(results)
    if (results.inspectedFile) {
      form.inspectedFilename.value = results.inspectedFile
    }
    window.results = results
    const list = document.createElement('dl')
    list.classList.add('mono')
    list.id = 'tagList'
    imgMetadata = results.metadata
    if (results?.modifiedFile && results.modifiedFile !== '') {
      const linkSection = document.createElement('section')
      linkSection.id = 'linkSection'
      const div = document.createElement('div')
      const a = document.createElement('a')
      a.href = `${origin}/inspected/${results.modifiedFile}`
      a.innerText = 'Save your image with metadata edits.'
      a.setAttribute('target', '_blank')
      div.appendChild(a)
      linkSection.appendChild(div)
      const parent = document.querySelector('div#main-content')
      parent.insertBefore(linkSection, document.querySelector('section#metadataSection'))
    }
    tags = Object.keys(results.metadata[0])
    tags.sort()
    // check if location info is present to display map
    let lat
    let NS
    let lon
    let EW
    let tagLocation
    const locationTagType = hasLocationTags(results.metadata[0])
    if (locationTagType) {
      [lat, lon, NS, EW, tagLocation] = getLocationCoordinates(locationTagType, results.metadata[0])
      if (lat !== null && lon !== null) {
        console.log(`image location: lat ${lat} ${NS}, lon ${lon} ${EW}`)
        await main(lat, lon, tagLocation)
        const map = document.querySelector('div#mapzone')
        map.classList.remove('hidden')
        const dt = document.createElement('dt')
        dt.appendChild(map)
        const locationListDiv = tagListDiv('locationzone')
        const dl = locationListDiv.querySelector(':scope > dl')
        dl.appendChild(dt)
        // add input fields for selecting new map location
        const dtNewLatitude = document.createElement('dt')
        const newLatitudeLabel = document.createElement('label')
        newLatitudeLabel.setAttribute('for', 'newLatitude')
        newLatitudeLabel.textContent = 'New Latitude'
        dtNewLatitude.appendChild(newLatitudeLabel)
        dl.appendChild(dtNewLatitude)
        const ddNewLatitude = document.createElement('dd')
        const newLatitudeInput = document.createElement('input')
        newLatitudeInput.type = 'text'
        newLatitudeInput.id = 'newLatitude'
        newLatitudeInput.setAttribute('name', 'newLatitude')
        ddNewLatitude.appendChild(newLatitudeInput)
        dl.appendChild(ddNewLatitude)
        const dtNewLongitude = document.createElement('dt')
        const newLongitudeLabel = document.createElement('label')
        newLongitudeLabel.setAttribute('for', 'newLongitude')
        newLongitudeLabel.textContent = 'New Longitude'
        dtNewLongitude.appendChild(newLongitudeLabel)
        dl.appendChild(dtNewLongitude)
        const ddNewLongitude = document.createElement('dd')
        const newLongitudeInput = document.createElement('input')
        newLongitudeInput.type = 'text'
        newLongitudeInput.id = 'newLongitude'
        newLongitudeInput.setAttribute('name', 'newLongitude')
        ddNewLongitude.appendChild(newLongitudeInput)
        dl.appendChild(ddNewLongitude)
        window.map.addEventListener('single-tap', (e) => {
          e.preventDefault()
          e.stopPropagation()
          const { latitude, longitude } = window.map.convertPointOnPageToCoordinate(e.pointOnPage)
          const newLat = document.querySelector('dd > input[name="newLatitude"]')
          const newLon = document.querySelector('dd > input[name="newLongitude"]')
          newLat.value = latitude
          newLon.value = longitude
        })
      }
    }
    let x = 0
    const seen = new Set()
    let showLocationTags = false
    let showOtherTags = false
    let showCARTags = false
    tags.forEach((tag) => {
      const [g, t] = tag.split(':')
      seen.add(g)
      x += 1
      const dtTag = document.createElement('dt')
      const ddTag = document.createElement('dd')
      dtTag.id = `tag_${x}`
      dtTag.innerHTML = `${tag}`
      ddTag.id = `val_${x}`
      if (/ThumbnailImage|PreviewImage|MPImage2/i.test(t)) {
        console.log('thumbnail tag found: ', t)
        const img = document.createElement('img')
        img.classList.add('smallImgPreview')
        const type = imgMetadata[0]['File:MIMEType']
        const imgData = imgMetadata[0][tag].slice(7)
        const imgSource = `data:${type};base64,${imgData}`
        img.src = imgSource
        ddTag.appendChild(img)
      } else {
        ddTag.innerHTML = `${imgMetadata[0][tag]}`
      }
      let locationTagIndex
      let carTagIndex
      if (/file/i.test(tag)) {
        // file tags
        const fileInfo = document.querySelector('dl#fileInfo')
        fileInfo.appendChild(dtTag)
        fileInfo.appendChild(ddTag)
        // eslint-disable-next-line
      } else if (locationTagIndex = isLocationTag(tag)) {
        // location tags
        window.locationtags[locationTagIndex].value = imgMetadata[0][tag]
        showLocationTags = true
        // eslint-disable-next-line
      } else if (carTagIndex = isCARTag(tag)) {
        // content, attributions, and rights
        window.cartags[carTagIndex].value = imgMetadata[0][tag]
        showCARTags = true
      } else {
        // all other metadata tags
        const otherMetadata = tagListDiv('metazone')
        const dl = otherMetadata.querySelector(':scope > dl')
        dl.appendChild(dtTag)
        dl.appendChild(ddTag)
        showOtherTags = true
      }
    })
    window.metazone.appendChild(list)
    if (showOtherTags) {
      window.metazone.classList.remove('hidden')
      window.metadataSection.appendChild(window.metazone)
    }
    if (showLocationTags) {
      const div = tagListDiv('locationzone')
      const dl = div.querySelector(':scope > dl')
      dl.id = 'locationDL'
      const mapPoints = []
      window.locationtags.forEach((t, i) => {
        if (Array.isArray(t.value)) {
          console.log('%s is an array of tag values', t.tag)
        }
        if (t.value !== '') {
          const label = document.createElement('label')
          label.setAttribute('for', `loc_val_${i}`)
          label.innerText = t.tag
          const dtTag = document.createElement('dt')
          const ddTag = document.createElement('dd')
          dtTag.appendChild(label)
          dl.appendChild(dtTag)
          let textfield
          if ((t.tag === 'XMP:LocationShown' || t.tag === 'XMP:LocationCreated') && Array.isArray(t.value)) {
            t.value.forEach((s, n) => {
              console.log(s)
              textfield = document.createElement('input')
              textfield.type = 'text'
              textfield.id = `loc_val_${i}_${n}`
              // textfield.name = `${t.tag}:${s}`
              textfield.name = `${t.tag}:LatLon:${n}`
              const Slat = t.value[n].GPSLatitude
              const Slon = t.value[n].GPSLongitude
              textfield.value = `${Slat}, ${Slon}`
              textfield.disabled = t.disabled
              ddTag.appendChild(textfield)
              mapPoints.push({ lat: convertFromPolarToScalar(Slat), lon: convertFromPolarToScalar(Slon), tag: `${t.tag} ${n + 1}` })
            })
          } else {
            textfield = document.createElement('input')
            textfield.type = 'text'
            textfield.id = `loc_val_${i}`
            textfield.name = t.tag
            textfield.value = t.value
            textfield.disabled = t.disabled
            ddTag.appendChild(textfield)
          }
          dl.appendChild(ddTag)
        }
      })
      if (mapPoints.length > 0) {
        addPointsToMap(mapPoints)
      }
      normalizeCoordinateTags()
    }
    if (showCARTags) {
      const div = tagListDiv('contentzone')
      const dl = div.querySelector(':scope > dl')
      window.cartags.forEach((t, i) => {
        if (t.value !== '') {
          const label = document.createElement('label')
          label.setAttribute('for', `car_val_${i}`)
          label.innerText = t.tag
          const dtTag = document.createElement('dt')
          const ddTag = document.createElement('dd')
          dtTag.appendChild(label)
          dl.appendChild(dtTag)
          const textarea = document.createElement('textarea')
          textarea.name = t.tag
          textarea.id = `car_val_${x}`
          textarea.rows = 3
          textarea.style.width = '95%'
          textarea.value = t.value
          ddTag.appendChild(textarea)
          dl.appendChild(ddTag)
        }
      })
      document.querySelector('div#contentzone').classList.remove('hidden')
    }
    const zones = window.metadataSection.children
    if (zones.locationzone) {
      zones.infozone.after(zones.locationzone)
      if (zones.locationzone.children[0].tagName !== 'H3') {
        const h3 = document.createElement('h3')
        h3.classList.add('mono')
        h3.innerText = 'Location Information'
        zones.locationzone.children[0].before(h3)
      }
    }
    if (zones.contentzone) {
      if (zones.locationzone) {
        zones.locationzone.after(zones.contentzone)
      } else {
        zones.infozone.after(zones.contentzone)
      }
    }
  } else {
    const responseErrDiv = document.createElement('div')
    responseErrDiv.id = 'responseError'
    const text = document.createTextNode(response.statusText)
    responseErrDiv.appendChild(text)
    window.fileInfo.insertBefore(responseErrDiv, window.fileInfo.children[0])
  }
}
