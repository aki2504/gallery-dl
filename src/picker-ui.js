import throttle from 'raf-throttle'

const svg = document.querySelector('body > svg')
const islands = document.querySelector('body > svg > path')

const quitButton = document.querySelector('.quit-button')
const downloadButton = document.querySelector('.download-button')

let lastX
let lastY

let isPaused = false

const startPicker = () => {
	window.addEventListener('mousemove', handleMouseMove)
	window.addEventListener('message', handleMessage)
	svg.addEventListener('click', handleSvgClick)
	quitButton.addEventListener('click', handleQuitButtonClick)
	downloadButton.addEventListener('click', handleDownloadButtonClick)
}

const handleMouseMove = throttle((event) => {
	lastX = event.pageX
	lastY = event.pageY

	if (!isPaused) {
		highlightImageAtPoint(event.pageX, event.pageY)
	}
})

const handleMessage = (event) => {
	switch (event.data.type) {
		case 'setSvgPath': {
			setSvgPath(event.data.path)
			break
		}
		case 'pausePicker': {
			pausePicker()
			break
		}
	}
}

const handleSvgClick = (event) => {
	if (isPaused) {
		unpausePicker()
	} else {
		pickImageAtPoint(event.pageX, event.pageY)
	}
}

const handleQuitButtonClick = () => {
	quitPicker()
}

const handleDownloadButtonClick = () => {
	startDownload()
	quitPicker()
}

const setSvgPath = (path) => {
	islands.setAttribute('d', path)
}

const pausePicker = () => {
	isPaused = true
	document.body.classList.add('is-paused')
}

const unpausePicker = () => {
	isPaused = false
	highlightImageAtPoint(lastX, lastY)
	document.body.classList.remove('is-paused')
}

const highlightImageAtPoint = (x, y) => {
	window.parent.postMessage({
		type: 'highlightImageAtPoint',
		x,
		y
	}, '*')
}

const pickImageAtPoint = (x, y) => {
	window.parent.postMessage({
		type: 'pickImageAtPoint',
		x,
		y
	}, '*')
}

const quitPicker = () => {
	window.parent.postMessage({ type: 'quitPicker' }, '*')
}

const startDownload = () => {
	window.parent.postMessage({ type: 'startDownload' }, '*')
}

startPicker()