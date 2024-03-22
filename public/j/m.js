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
window.xmptags = [
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
  { tag: 'IPTC:Sub-location', value: '' },
  { tag: 'IPTC:Country-PrimaryLocationName', value: '' },
  { tag: 'IPTC:Country-PrimaryLocationCode', value: '' },

  { tag: 'XMP:LocationShown', value: '', disabled: false },
  { tag: 'XMP:LocationShownGPSLatitude', value: '', disabled: false },
  { tag: 'XMP:LocationShownGPSLongitude', value: '', disabled: false },
  { tag: 'XMP:LocationShownGPSAltitude', value: '', disabled: true },
  { tag: 'XMP:LocationShownCity', value: '', disabled: true },
  { tag: 'XMP:LocationShownProvinceState', value: '', disabled: true },
  { tag: 'XMP:LocationShownCountryName', value: '', disabled: true },
  { tag: 'XMP:LocationShownCountryCode', value: '', disabled: true },
  { tag: 'XMP:LocationShownSublocation', value: '', disabled: true },
  { tag: 'XMP:LocationCreated', value: '', disabled: false },
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
let mapzone = document.querySelector('div#mapzone')
const formData = new FormData()
function isXMPTagNotLocation(tag) {
  // console.log(`isXMPTag: ${tag}`)
  const xmp = tag.match(/^(?<group>xmp):(?<preset>(?!(location.*|city|country.+)).*)/i)
  if (xmp?.groups?.preset) {
    // console.log('yes: ', xmp.groups.group, xmp.groups.preset)
    return true
  }
  // console.log('no', tag)
  return false
}
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
    tag = 'XMP Location Shown (struct)'
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
  const xmpLocation = dl.querySelector(':scope input[name="XMP:Location"]')
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
    if (xmpLocation !== null) xmpLocation.disabled = false
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
      dl = document.createElement('dl')
      div.appendChild(dl)
    }
  }
  return div
}
function addPointsToMap(points) {
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
  if (Number.isFinite(coord)) {
    return coord
  }
  const x = coord.match(/(?<sign>\+|-)?(?<n>\d{1,3}\.?\d{0,9})\s?(?<c>[NSEW])?/i)
  if (x.groups.sign !== undefined) {
    return parseFloat(`${(x.groups.sign === '-' ? '-' : '')}${x.groups.n}`)
  }
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

window.editedCARTags = new Map()
function focusCARTag(e) {
  if (!window.editedCARTags.has(e.target.name)) {
    console.info('focus: ', e.target.name, e.target.value)
    window.editedCARTags.set(e.target.name, [e.target.value])
  }
}
function changeCARTag(e) {
  const values = window.editedCARTags.get(e.target.name) ?? []
  if (values[0] !== e.target.value) {
    values[1] = e.target.value
    console.info('change: ', window.editedCARTags.get(e.target.name))
    window.editedCARTags.set(e.target.name, values)
  } else {
    console.info('no change: ', window.editedCARTags.get(e.target.name))
  }
}
function resetCARTags(e) {
  console.log('reseting CAR tags: ', e)
  window.editedCARTags.forEach((v, k) => {
    [document.querySelector(`input[name="${k}"]`).value] = v
  })
  window.editedCARTags.clear()
}
async function submitCAREdits(e) {
  e.preventDefault()
  e.stopPropagation()
  if (window.editedCARTags.size > 0) {
    window.editedCARTags.forEach((v, k) => {
      if (v[1] !== undefined) {
        window.carFormData.append(k, v[1])
      }
    })
    const entries = window.carFormData.entries()
    const empty = entries.next()
    if (!empty.done) {
      window.carFormData.append('inspectedFilename', form.inspectedFilename.value)
      window.carFormData.append('csrfTokenHidden', form['csrf-token'].value)
      // console.log('post ', ...entries)
      const opts = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${window.access}`,
        },
        body: window.carFormData,
      }
      console.log(opts)
      const url = new window.URL(`${origin}/editCAR`)
      console.log(url.toString())
      const request = new Request(url, opts)
      console.log(request)
      let response
      let results
      let msg
      try {
        response = await fetch(request, { credentials: 'same-origin' })
        if (response.status === 200) {
          results = await response.json()
          // console.log(results)
          window.editedCARTags.clear()
          if (results.modifiedFile !== undefined) {
            insertLink(results.modifiedFile, response.status)
          }
          window.newCARResults = response
          msg = 'Image metadata was updated.  The link to save the file is listed above.'
        } else {
          insertLink(results.modifiedFile, response.status)
          msg = 'Content, Attributions, and Rights metadata update failed 🤷'
        }
        updateFormStatus(e.target.elements[0], msg)
      } catch (err) {
        console.info('problem with fetch or response')
        console.info(err)
      }
      return true
    }
  }
  console.info('clicked submit, but no changes made.')
  return false
}
window.editedLocationTags = new Map()
function focusLocationTag(e) {
  if (!window.editedLocationTags.has(e.target.name)) {
    console.log('focus: ', e.target.name, e.target.value)
    window.editedLocationTags.set(e.target.name, [e.target.value])
  }
}
function changeLocationTag(e) {
  const values = window.editedLocationTags.get(e.target.name) ?? []
  if (values[0] !== e.target.value) {
    values[1] = e.target.value
    console.log('change: ', window.editedLocationTags.get(e.target.name))
    window.editedLocationTags.set(e.target.name, values)
  } else {
    console.log('no change: ', window.editedLocationTags.get(e.target.name))
  }
}
async function submitLocationEdits(e) {
  e.preventDefault()
  e.stopPropagation()
  // console.log('pre ', ...window.locationFormData.entries())
  if (window.editedLocationTags.size > 0) {
    window.editedLocationTags.forEach((v, k) => {
      if (v[1] !== undefined) {
        window.locationFormData.append(k, v[1])
      }
    })
    const entries = window.locationFormData.entries()
    const empty = entries.next()
    if (!empty.done) {
      window.locationFormData.append('inspectedFilename', form.inspectedFilename.value)
      window.locationFormData.append('csrfTokenHidden', form['csrf-token'].value)
      // console.log('post ', ...entries)
      const opts = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${window.access}`,
        },
        body: window.locationFormData,
      }
      console.log(opts)
      const url = new window.URL(`${origin}/editLocation`)
      console.log(url.toString())
      const request = new Request(url, opts)
      console.log(request)
      let response
      let results
      let msg
      try {
        response = await fetch(request, { credentials: 'same-origin' })
        if (response.status === 200) {
          results = await response.json()
          // console.log(results)
          window.editedLocationTags.clear()
          if (results.modifiedFile !== undefined) {
            insertLink(results.modifiedFile, response.status)
          }
          window.newLocationResults = response
          msg = 'Location metadata was updated.  The link to save the file is listed above.'
        } else {
          insertLink(results.modifiedFile, response.status)
          msg = 'Location metadata update failed 🤷'
        }
        updateFormStatus(e.target.elements[0], msg)
      } catch (err) {
        console.info('problem with fetch or response')
        console.info(err)
      }
      return true
    }
  }
  console.info('clicked submit, but no changes made.')
  return false
}
function resetLocationTags(e) {
  console.log('reseting location tags: ', e)
  window.editedLocationTags.forEach((v, k) => {
    [document.querySelector(`input[name="${k}"]`).value] = v
  })
  window.editedLocationTags.clear()
}
function updateFormStatus(fieldset, status) {
  if (fieldset && status) {
    const msg = document.createTextNode(status)
    const a = document.createElement('a')
    a.href = '#linkSection'
    a.textContent = ' # '
    const div = document.createElement('div')
    div.classList.add('mono')
    div.style.margin = '1em .5em .5em 1em'
    div.appendChild(msg)
    div.appendChild(a)
    fieldset.appendChild(div)
  }
}
function insertClearButton() {
  let clearSection = document.querySelector('section#clearSection')
  if (clearSection) {
    clearSection.removeChild(clearSection.children[0])
  } else {
    clearSection = document.createElement('section')
    clearSection.id = 'clearSection'
    console.info('clear results seciton created.')
  }
  const div = document.createElement('div')
  div.classList.add('clear')
  const clearButton = document.createElement('button')
  clearButton.textContent = 'Clear Results'
  clearButton.setAttribute('id', 'clearResults_Id')
  clearButton.setAttribute('name', 'clearResults')
  clearButton.addEventListener('click', window.clearResults)
  div.appendChild(clearButton)
  clearSection.appendChild(div)
  const parent = document.querySelector('div#main-content')
  parent.insertBefore(clearSection, document.querySelector('section#metadataSection'))
  console.info('clear results button added.')
}
window.clearResults = (e) => {
  e.preventDefault()
  e.stopPropagation()
  const parent = e.target.parentElement.parentElement
  console.info('clearbutton section:', parent)
  parent.parentElement.removeChild(parent)
  document.forms.uploaderId.hiddenFields_Id.elements[0].value = ''
  const clearInfoZone = document.querySelector('div#infozone')
  if (clearInfoZone && clearInfoZone.children.length > 1) {
    clearInfoZone.removeChild((clearInfoZone.children).item(1))
    clearInfoZone.classList.add('hidden')
  }
  const clearLocationZone = document.querySelector('div#locationzone')
  if (clearLocationZone && clearLocationZone.children.length > 1) {
    clearLocationZone.removeChild((clearLocationZone.children).item(1))
    clearLocationZone.removeChild((clearLocationZone.children).item(1))
    clearLocationZone.classList.add('hidden')
    // recreate weird hidden mapzone div if necessary
    // let mapDiv = document.querySelector('div#mapzone')
    mapzone = document.querySelector('div#mapzone')
    if (!mapzone) {
      mapzone = document.createElement('div')
      mapzone.id = 'mapzone'
      mapzone.classList.add('hidden')
      clearLocationZone.parentElement.appendChild(mapzone)
    }
  }
  const clearContentZone = document.querySelector('div#contentzone')
  if (clearContentZone && clearContentZone.children.length > 1) {
    console.info(clearContentZone.children)
    clearContentZone.removeChild((clearContentZone.children).item(1))
    clearContentZone.removeChild((clearContentZone.children).item(1))
    clearContentZone.classList.add('hidden')
  }
  const clearMetaZone = document.querySelector('div#metazone')
  if (clearMetaZone && clearMetaZone.children.length > 1) {
    clearMetaZone.removeChild((clearMetaZone.children).item(1))
    clearMetaZone.classList.add('hidden')
  }
  document.querySelector('input#url_Id').value = ''
  /* eslint-disable no-param-reassign */
  window.cartags.forEach((c) => { c.value = '' })
  window.locationtags.forEach((l) => { l.value = '' })
  /* eslint-enable no-param-reassign */
}
function insertLink(link, code) {
  let linkSection = document.querySelector('section#linkSection')
  if (linkSection) {
    linkSection.removeChild(linkSection.children[0])
  } else {
    linkSection = document.createElement('section')
    linkSection.id = 'linkSection'
  }
  const div = document.createElement('div')
  if (code === 200) {
    const a = document.createElement('a')
    a.href = `${origin}/inspected/${link}`
    a.innerText = 'Save your image with metadata edits.'
    a.setAttribute('target', '_blank')
    div.classList.add('save')
    div.appendChild(a)
  } else if ((code > 400) && (code < 500)) {
    const error4xx = document.createTextNode(`Metadata edit was unsuccesful for image ${link}.`)
    div.appendChild(error4xx)
  } else {
    const error5xx = document.createTextNode('The server was unable to do it\'s job for some reason...')
    div.appendChild(error5xx)
  }
  linkSection.appendChild(div)
  const parent = document.querySelector('div#main-content')
  parent.insertBefore(linkSection, document.querySelector('section#metadataSection'))
}
async function setFileInfo(file = null) {
  formData.append('csrfTokenHidden', form['csrf-token'].value)
  formData.append('tagSet', form.tagSet.value)
  infozone.classList.remove('hidden')
  if (file !== null) {
    const ul = document.querySelector('ul#fileInfo')
    if (infozone.contains(ul)) {
      infozone.removeChild(ul)
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
      img.appendChild(document.createTextNode('HEIC images are too tough for poor wittle Chrome to display.'))
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
    // insertClearButton()
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
      insertLink(results.modifiedFile, response.status)
    }
    // tags = Object.keys(results.metadata[0])
    // tags.sort()
    // check if location info is present to display map
    let lat
    let NS
    let lon
    let EW
    let tagLocation
    const locationTagType = hasLocationTags(results.metadata[0])
    if (locationTagType) {
      [lat, lon, NS, EW, tagLocation] = getLocationCoordinates(locationTagType, results.metadata[0])
      if (NS === undefined) {
        NS = (parseFloat(lat) > 0) ? 'North' : 'South'
      }
      if (EW === undefined) {
        EW = (parseFloat(lon) > 0) ? 'East' : 'West'
      }
      if (lat !== null && lon !== null) {
        console.log(`image location: lat ${lat} ${NS}, lon ${lon} ${EW}`)
        console.log('locationTagType', locationTagType)
        console.log('tagLocation', tagLocation)
        if (results.metadata[0]?.['EXIF:GPSLatitude'] === undefined) {
          results.metadata[0]['EXIF:GPSLatitude'] = lat
          results.metadata[0]['EXIF:GPSLatitudeRef'] = NS
          results.metadata[0]['EXIF:GPSLongitude'] = lon
          results.metadata[0]['EXIF:GPSLongitudeRef'] = EW
        }
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
        newLatitudeInput.placeholder = 'Select a location on the map to get new coordinates.'
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
        newLongitudeInput.placeholder = 'Select a location on the map to get new coordinates.'
        ddNewLongitude.appendChild(newLongitudeInput)
        dl.appendChild(ddNewLongitude)
        window.map.addEventListener('single-tap', (e) => {
          e.preventDefault()
          e.stopPropagation()
          let { latitude, longitude } = window.map.convertPointOnPageToCoordinate(e.pointOnPage)
          latitude = latitude.toFixed(6)
          longitude = longitude.toFixed(6)
          let cLatitude = 'N'
          let cLongitude = 'E'
          let negLat = 1
          let negLon = 1
          const newLat = document.querySelector('dd > input[name="newLatitude"]')
          const newLon = document.querySelector('dd > input[name="newLongitude"]')
          if (parseFloat(latitude) < 0) {
            cLatitude = 'S'
            negLat = -1
          }
          if (parseFloat(longitude) < 0) {
            cLongitude = 'W'
            negLon = -1
          }
          newLat.value = `${latitude}\tor\t${parseFloat(latitude) * negLat} ${cLatitude}`
          newLon.value = `${longitude}\tor\t${parseFloat(longitude) * negLon} ${cLongitude}`
        })
      }
    }
    let x = 1
    let showLocationTags = false
    let showOtherTags = false
    let showCARTags = false
    let showXMPTags = false
    tags = Object.keys(results.metadata[0])
    tags.sort()
    tags.forEach((tag) => {
      const [, t] = tag.split(':')
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
      } else if (isXMPTagNotLocation(tag)) {
        // adobe xmp develop / preset / look tags
        window.xmptags.push({ tag, value: imgMetadata[0][tag] })
        showXMPTags = true
      } else if (locationTagIndex = isLocationTag(tag)) { // eslint-disable-line
        // location tags
        window.locationtags[locationTagIndex].value = imgMetadata[0][tag]
        showLocationTags = true
      } else if (carTagIndex = isCARTag(tag)) { // eslint-disable-line
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
          // console.log('t.value', t.tag, t.value)
          if ((t.tag === 'XMP:LocationShown' || t.tag === 'XMP:LocationCreated') && Array.isArray(t.value)) {
            t.value.forEach((s, n) => {
              console.log('s', typeof s, s)
              if (typeof s === 'object') {
                Object.entries(s).forEach((xmp) => {
                  const sLabel = document.createElement('label')
                  sLabel.setAttribute('for', `XMP:LocationShown${xmp[0]}_id`)
                  sLabel.textContent = `XMP:LocationShown${xmp[0]}`
                  const dtTag = document.createElement('dt')
                  const ddTag = document.createElement('dd')
                  dtTag.appendChild(sLabel)
                  dl.appendChild(dtTag)
                  const sTextfield = document.createElement('input')
                  sTextfield.type = 'text'
                  sTextfield.id = `XMP:${xmp[0]}_id`
                  sTextfield.name = `XMP:${xmp[0]}`;
                  [, sTextfield.value] = xmp
                  sTextfield.disabled = t.disabled ?? false
                  sTextfield.addEventListener('focus', focusLocationTag)
                  sTextfield.addEventListener('change', changeLocationTag)
                  ddTag.appendChild(sTextfield)
                  dl.appendChild(ddTag)
                })
              }
              const m = n + 1
              const label = document.createElement('label')
              label.setAttribute('for', `loc_val_${i}_${m}`)
              label.textContent = `${t.tag} #${m}`
              const dtTag = document.createElement('dt')
              const ddTag = document.createElement('dd')
              dtTag.appendChild(label)
              dl.appendChild(dtTag)
              const textfield = document.createElement('input')
              textfield.type = 'text'
              textfield.id = `loc_val_${i}_${m}`
              textfield.name = `${t.tag}:LatLon:${m}`
              const Slat = t.value[n].GPSLatitude
              const Slon = t.value[n].GPSLongitude
              textfield.value = `${Slat}, ${Slon}`
              textfield.disabled = t.disabled ?? false
              console.info(t, t.disabled)
              if (!textfield.disabled) {
                // console.log('add change event listener to ', textfield.name)
                textfield.addEventListener('focus', focusLocationTag)
                textfield.addEventListener('change', changeLocationTag)
              }
              ddTag.appendChild(textfield)
              dl.appendChild(ddTag)
              mapPoints.push({ lat: convertFromPolarToScalar(Slat), lon: convertFromPolarToScalar(Slon), tag: `${t.tag} #${m}` })
            })
          } else {
            const label = document.createElement('label')
            label.setAttribute('for', `loc_val_${i}`)
            label.innerText = t.tag
            const dtTag = document.createElement('dt')
            const ddTag = document.createElement('dd')
            dtTag.appendChild(label)
            dl.appendChild(dtTag)
            const textfield = document.createElement('input')
            textfield.type = 'text'
            textfield.id = `loc_val_${i}`
            textfield.name = t.tag
            textfield.value = t.value
            textfield.disabled = t.disabled
            if (!textfield.disabled) {
              // console.log('add change event listener to ', textfield.name)
              textfield.addEventListener('focus', focusLocationTag)
              textfield.addEventListener('change', changeLocationTag)
            }
            ddTag.appendChild(textfield)
            dl.appendChild(ddTag)
          }
        }
      })
      const locationForm = document.createElement('form')
      locationForm.id = 'locationForm'
      locationForm.name = 'location'
      locationForm.action = `${origin}/editLocation`
      locationForm.method = 'POST'
      locationForm.enctype = 'multipart/form-data'
      const locationFieldset = document.createElement('fieldset')
      locationForm.appendChild(locationFieldset)
      const locationLegend = document.createElement('legend')
      locationLegend.textContent = 'Update Location Metadata'
      locationLegend.classList.add('mono')
      locationFieldset.appendChild(locationLegend)
      const locationSubmit = document.createElement('input')
      locationSubmit.type = 'submit'
      locationSubmit.id = 'locationSubmit_Id'
      locationSubmit.name = 'locationSubmit'
      window.locationFormData = new FormData(locationForm)
      console.dir('locationFormData: ', ...window.locationFormData.entries())
      locationForm.addEventListener('submit', submitLocationEdits)
      locationFieldset.appendChild(locationSubmit)
      const locationReset = document.createElement('input')
      locationReset.type = 'reset'
      locationReset.addEventListener('click', resetLocationTags)
      locationFieldset.appendChild(locationReset)
      div.appendChild(locationForm)
      if (mapPoints.length > 0) {
        addPointsToMap(mapPoints)
      }
      normalizeCoordinateTags()
      window.locationzone.classList.remove('hidden')
    }
    if (showCARTags) {
      const div = tagListDiv('contentzone')
      const dl = div.querySelector(':scope > dl')
      window.cartags.forEach((t, i) => {
        if (t.value !== '') {
          const label = document.createElement('label')
          label.setAttribute('for', `car_val_${x}_${i}`)
          label.innerText = t.tag
          const dtTag = document.createElement('dt')
          const ddTag = document.createElement('dd')
          dtTag.appendChild(label)
          dl.appendChild(dtTag)
          const textarea = document.createElement('textarea')
          textarea.name = t.tag
          textarea.id = `car_val_${x}_${i}`
          textarea.rows = 3
          textarea.style.width = '95%'
          textarea.value = t.value
          if (!textarea.disabled) {
            // console.log('add change event listener to ', textarea.name)
            textarea.addEventListener('focus', focusCARTag)
            textarea.addEventListener('change', changeCARTag)
          }
          ddTag.appendChild(textarea)
          dl.appendChild(ddTag)
        }
      })
      const carForm = document.createElement('form')
      carForm.id = 'carForm'
      carForm.name = 'car'
      carForm.action = `${origin}/editCAR`
      carForm.method = 'POST'
      carForm.enctype = 'multipart/form-data'
      const carFieldset = document.createElement('fieldset')
      const carLegend = document.createElement('legend')
      carLegend.textContent = 'Update Content, Rights, and Attribution Metadata'
      carLegend.classList.add('mono')
      carFieldset.appendChild(carLegend)
      const carSubmit = document.createElement('input')
      carSubmit.type = 'submit'
      carSubmit.id = 'carSubmit_Id'
      carSubmit.name = 'carSubmit'
      window.carFormData = new FormData(carForm)
      // console.dir('carFormData: ', ...window.carFormData.entries())
      carForm.addEventListener('submit', submitCAREdits)
      carFieldset.appendChild(carSubmit)
      const carReset = document.createElement('input')
      carReset.type = 'reset'
      carReset.addEventListener('click', resetCARTags)
      carFieldset.appendChild(carReset)
      carForm.appendChild(carFieldset)
      div.appendChild(carForm)
      document.querySelector('div#contentzone').classList.remove('hidden')
    }
    if (showXMPTags) {
      console.log('showing xmp tags')
      console.dir(window.xmptags)
      const div = tagListDiv('xmpzone')
      const dl = div.querySelector(':scope > dl')
      window.xmptags.forEach((t) => {
        if (t.value !== '' && /(?<group>xmp):(?<tag>(?!history).*)/i.test(t.tag)) {
          const dtTag = document.createElement('dt')
          dtTag.textContent = t.tag
          const ddTag = document.createElement('dd')
          if (Array.isArray(t.value)) {
            console.log(`${t.tag} is array: ${t.value}`)
            // ddTag.textContent = 'Array of values'
            ddTag.innerHTML = t.value.join('\n<br>\n')
          } else {
            ddTag.textContent = `${t.value}`
          }
          dl.appendChild(dtTag)
          dl.appendChild(ddTag)
        }
      })
      div.appendChild(dl)
      document.querySelector('div#xmpzone').classList.remove('hidden')
    }
    const zones = window.metadataSection.children
    if (!zones?.locationzone.classList.contains('hidden')) {
      zones.infozone.after(zones.locationzone)
      if (zones.locationzone.children[0].tagName !== 'H3') {
        const h3 = document.createElement('h3')
        h3.classList.add('mono')
        h3.innerText = 'Location Information'
        zones.locationzone.children[0].before(h3)
      }
    }
    if (!zones?.contentzone.classList.contains('hidden')) {
      if (zones.locationzone) {
        zones.locationzone.after(zones.contentzone)
      } else {
        zones.infozone.after(zones.contentzone)
      }
    }
    if (!zones?.xmpzone.classList.contains('hidden')) {
      if (!zones?.contentnzone.classList.contains('hidden')) {
        zones.contentzone.after(zones.xmpzone)
      } else {
        zones.infozone.after(zones.xmpzone)
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
