const cartags = [
  'EXIF:Artist',
  'XMP:Artist',
  'XMP:Creator',
  'IPTC:By-line',
  'XMP:AuthorsPosition',
  'IPTC:Credit',
  'IPTC:Source',
  'IPTC:By-lineTitle',
  'IPCT:Headline',
  'XMP:Title',
  'XMP:Headline',
  'IPTC:Caption-Abstract',
  'XMP:ImageDescription',
  'XMP:Description',
  'CopyrightNotice',
  'IPTC:Keywords',
  'XMP:Subject',
  'IPTC:Copyright',
  'XMP:Rights',
  'XMP:CopyrightFlag',
  'XMP:Url',
  'XMP:WebStatement',
  'XMPLLicensorURL',
]
// const origin = '<%= origin %>'
// const access = '<%= accessToken %>'
const form = document.forms[0]
const fileElement = form.image_0Id
const submitButton = form.submit_Id
const dragzone = document.querySelector('div#dragzone')
const infozone = document.querySelector('div#infozone')
// const metazone = document.querySelector('div#metazone')
const mapzone = document.querySelector('div#mapzone')
const formData = new FormData()
// let map
function isCARTag(tag) {
  return cartags.includes(tag)
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
  }
  // console.log(`returning div: ${div}`)
  return div
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
async function main(lat, lon) {
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
    const annotation = new window.mapkit.MarkerAnnotation(marker)
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
  await send(formData)
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
    // check if location info is present to display map
    let lat
    let NS
    let lon
    let EW
    if (tags.includes('EXIF:GPSLongitude') && tags.includes('EXIF:GPSLatitude')) {
      lat = parseFloat(imgMetadata[0]['EXIF:GPSLatitude'])
      NS = imgMetadata[0]['EXIF:GPSLatitudeRef']
      if (/south/i.test(NS)) lat *= (-1)
      lon = parseFloat(imgMetadata[0]['EXIF:GPSLongitude'])
      EW = imgMetadata[0]['EXIF:GPSLongitudeRef']
      if (/west/i.test(EW)) lon *= (-1)
    } else if (tags.includes('Composite:GPSPosition')) {
      const [_lat, _lon] = imgMetadata[0]['Composite:GPSPosition'].split(', ');
      [lat, NS] = _lat.split(' ')
      lat = parseFloat(lat)
      if (/s/i.test(NS)) lat *= (-1);
      [lon, EW] = _lon.split(' ')
      lon = parseFloat(lon)
      if (/w/i.test(EW)) lon *= (-1)
    } else {
      lat = null
      lon = null
    }
    if (lat !== null && lon !== null) {
      console.log(`image location: lat ${lat} ${NS}, lon ${lon} ${EW}`)
      await main(lat, lon)
      const map = document.querySelector('div#mapzone')
      map.classList.remove('hidden')
      const dt = document.createElement('dt')
      dt.appendChild(map)
      const locationListDiv = tagListDiv('locationzone')
      const dl = locationListDiv.children[0]
      dl.appendChild(dt)
    }
    let x = 0
    const seen = new Set()
    // let showLocationTags = false
    let showOtherTags = false
    let showCARTags = false
    // for(const tag of tags) {
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
      if (/file/i.test(tag)) {
        // file tags
        const fileInfo = document.querySelector('dl#fileInfo')
        fileInfo.appendChild(dtTag)
        fileInfo.appendChild(ddTag)
      } else if (/gps/i.test(tag)) {
        // location tags
        const div = tagListDiv('locationzone')
        const dl = div.querySelector(':scope > dl')
        dl.appendChild(dtTag)
        dl.appendChild(ddTag)
        // showLocationTags = true
      } else if (isCARTag(tag)) {
        // content, attributions, and rights
        const div = tagListDiv('contentzone')
        const dl = div.querySelector(':scope > dl')
        const label = document.createElement('label')
        label.setAttribute('for', `val_${x}`)
        label.innerText = tag
        // dl.appendChild(dtTag)
        dtTag.removeChild(dtTag.firstChild)
        dtTag.appendChild(label)
        dl.appendChild(dtTag)
        const textarea = document.createElement('textarea')
        textarea.name = tag
        textarea.id = `val_${x}`
        textarea.rows = 3
        textarea.style.width = '95%'
        textarea.value = `${imgMetadata[0]?.[tag]}`
        ddTag.replaceChild(textarea, ddTag.firstChild)
        dl.appendChild(ddTag)
        showCARTags = true
      } else {
        // all other metadata tags
        const otherMetadata = tagListDiv('metazone')
        const dl = otherMetadata.querySelector(':scope > dl')
        dl.appendChild(dtTag)
        dl.appendChild(ddTag)
        showOtherTags = true
      }
    // }
    })
    // metazone.appendChild(list)
    // if (showOtherTags) {
    //   metazone.classList.remove('hidden')
    //   metadataSection.appendChild(metazone)
    // }
    if (showCARTags) {
      document.querySelector('div#contentzone').classList.remove('hidden')
    }
  } else {
    const responseErrDiv = document.createElement('div')
    responseErrDiv.id = 'responseError'
    const text = document.createTextNode(response.statusText)
    responseErrDiv.appendChild(text)
    window.fileInfo.insertBefore(responseErrDiv, window.fileInfo.children[0])
  }
}
