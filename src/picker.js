import { parseSrcset } from 'srcset'
import throttle from 'raf-throttle'
import filenamify from 'filenamify/browser'

const pickerStyleLink = document.createElement('link')
pickerStyleLink.rel = 'stylesheet'
pickerStyleLink.href = chrome.runtime.getURL('picker.css')

const pickerRoot = document.createElement('iframe')
pickerRoot.classList.add('_picker-root')
pickerRoot.src = chrome.runtime.getURL('picker-ui.html')

let elementsToHighlight = []
let candidateImages = []

const startPicker = () => {
	document.head.append(pickerStyleLink)
	document.body.append(pickerRoot)

	window.addEventListener('message', handleMessage)
	window.addEventListener('resize', handleViewportChange)
	window.addEventListener('scroll', handleViewportChange)
}

const quitPicker = () => {
	pickerStyleLink.remove()
	pickerRoot.remove()

	window.removeEventListener('message', handleMessage)
	window.removeEventListener('resize', handleViewportChange)
	window.removeEventListener('scroll', handleViewportChange)
}

const handleMessage = (event) => {
	switch (event.data.type) {
		case 'highlightImageAtPoint': {
			highlightImageAtPoint(event.data.x, event.data.y)
			break
		}
		case 'pickImageAtPoint': {
			pickImageAtPoint(event.data.x, event.data.y)
			break
		}
		case 'unhighlightElements': {
			highlightElements([])
			break
		}
		case 'quitPicker': {
			quitPicker()
			break
		}
		case 'startDownload': {
			startDownload()
			break
		}
	}
}

const handleViewportChange = throttle(() => {
	highlightElements(elementsToHighlight)
})

const highlightImageAtPoint = (x, y) => {
	const element = getElementFromPoint(x, y)

	if (element.tagName === 'IMG') {
		highlightElements([element])
	} else {
		highlightElements()
	}
}

const getElementFromPoint = (x, y) => {
	return document.elementsFromPoint(x, y)[1]
}

const highlightElements = (elements = []) => {
	elementsToHighlight = elements

	const paths = []

	for (const element of elements) {
		const {x, y, width, height} = element.getBoundingClientRect()
		paths.push(`M ${x} ${y} v ${height} h ${width} v -${height} z`)
	}

	setSvgPath(paths.join(' '))
}

const pickImageAtPoint = (x, y) => {
	const element = getElementFromPoint(x, y)

	// TODO: img 要素以外の要素にも対応
	if (element.tagName !== 'IMG') {
		return
	}

	const selector = getSelectorFromElement(element)
	candidateImages = document.querySelectorAll(selector)
	highlightElements(candidateImages)

	pausePicker()
}

const getSelectorFromElement = (element) => {
	const parts = []

	while (element !== document.documentElement) {
		let part = element.localName

		if (element.classList.length !== 0) {
			const classNames = element.classList.values()
			for (const className of classNames) {
				part += `.${className}`
			}
		}

		if (element.id !== '') {
			const ids = element.id.split(' ').filter(id => id)
			for (const id of ids) {
				part += `#${id}`
			}
		}

		parts.unshift(part)

		element = element.parentElement
	}

	return parts.join(' > ')
}

const startDownload = () => {
	const urls = Array.from(candidateImages).map(image => getImageUrlFromElement(image)).filter(url => url)
	const title = filenamify(document.title)

	chrome.runtime.sendMessage({
		type: 'startDownload',
		urls,
		title
	})
}

const getImageUrlFromElement = (element) => {
	// TODO: img 要素以外の要素にも対応
	if (element.tagName === 'IMG') {
		return getImageUrlFromImage(element)
	}

	return null
}

const getImageUrlFromImage = (image) => {
	if (image.srcset) {
		return getHighestResolutionImageUrlFromSrcset(image.srcset)
	} else {
		return image.src
	}
}

const getHighestResolutionImageUrlFromSrcset = (srcsetString) => {
		const srcset = parseSrcset(srcsetString)

		let descriptor

		if (srcset[0].hasOwnProperty('width')) {
			descriptor = 'width'
		} else if (srcset[0].hasOwnProperty('height')) {
			descriptor = 'height'
		} else if (srcset[0].hasOwnProperty('density')) {
			descriptor = 'density'
		} else {
			return null
		}

		let maxValue = 0
		let result

		for (const item of srcset) {
			const value = item[descriptor]

			if (value > maxValue) {
				result = item.url
			}
		}

		return result
}

const setSvgPath = (path) => {
	pickerRoot.contentWindow.postMessage({
		type: 'setSvgPath',
		path
	}, '*')
}

const pausePicker = () => {
	pickerRoot.contentWindow.postMessage({ type: 'pausePicker' }, '*')
}

if (!document.querySelector('._picker-root')) {
	startPicker()
}