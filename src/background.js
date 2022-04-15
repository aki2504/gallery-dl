const downloadDataMap = new Map()

const handleAction = (tab) => {
	startPicker(tab.id)
}

const handleMessage = (message) => {
	switch (message.type) {
		case 'startDownload': {
			startDownload(message.urls, message.title)
			break
		}
	}
}

const handleDeterminingFilename = (item, suggest) => {
	const data = downloadDataMap.get(item.id)

	if (!data) {
		return
	}

	const extension = getExtensionFromFilename(item.filename)
	const filename = `${data.title}/${data.index}.${extension}`
	suggest({ filename })
}

const handleChanged = (item) => {
	const data = downloadDataMap.get(item.id)

	if (!data) {
		return
	}

	if (item.state?.current === 'complete') {
		downloadDataMap.delete(item.id)
	}
}

const getExtensionFromFilename = (filename) => {
	return filename.split('.').pop()
}

const startDownload = (urls, title) => {
	for (const [index, url] of urls.entries()) {
		chrome.downloads.download({ url })
			.then(id => downloadDataMap.set(id, { title, index }))
	}
}

const startPicker = (tabId) => {
	chrome.scripting.executeScript({
		files: ['picker.js'],
		target: { tabId }
	})
}

chrome.action.onClicked.addListener(handleAction)
chrome.runtime.onMessage.addListener(handleMessage)
chrome.downloads.onDeterminingFilename.addListener(handleDeterminingFilename)
chrome.downloads.onChanged.addListener(handleChanged)