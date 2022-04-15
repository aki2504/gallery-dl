(function () {
	'use strict';

	/**
	This regex represents a loose rule of an “image candidate string”.

	@see https://html.spec.whatwg.org/multipage/images.html#srcset-attribute

	An “image candidate string” roughly consists of the following:
	1. Zero or more whitespace characters.
	2. A non-empty URL that does not start or end with `,`.
	3. Zero or more whitespace characters.
	4. An optional “descriptor” that starts with a whitespace character.
	5. Zero or more whitespace characters.
	6. Each image candidate string is separated by a `,`.

	We intentionally implement a loose rule here so that we can perform more aggressive error handling and reporting in the below code.
	*/
	const imageCandidateRegex = /\s*([^,]\S*[^,](?:\s+[^,]+)?)\s*(?:,|$)/;

	const duplicateDescriptorCheck = (allDescriptors, value, postfix) => {
		allDescriptors[postfix] = allDescriptors[postfix] || {};
		if (allDescriptors[postfix][value]) {
			throw new Error(`No more than one image candidate is allowed for a given descriptor: ${value}${postfix}`);
		}

		allDescriptors[postfix][value] = true;
	};

	const fallbackDescriptorDuplicateCheck = allDescriptors => {
		if (allDescriptors.fallback) {
			throw new Error('Only one fallback image candidate is allowed');
		}

		if (allDescriptors.x['1']) {
			throw new Error('A fallback image is equivalent to a 1x descriptor, providing both is invalid.');
		}

		allDescriptors.fallback = true;
	};

	const descriptorCountCheck = (allDescriptors, currentDescriptors) => {
		if (currentDescriptors.length === 0) {
			fallbackDescriptorDuplicateCheck(allDescriptors);
		} else if (currentDescriptors.length > 1) {
			throw new Error(`Image candidate may have no more than one descriptor, found ${currentDescriptors.length}: ${currentDescriptors.join(' ')}`);
		}
	};

	const validDescriptorCheck = (value, postfix, descriptor) => {
		if (Number.isNaN(value)) {
			throw new TypeError(`${descriptor || value} is not a valid number`);
		}

		switch (postfix) {
			case 'w': {
				if (value <= 0) {
					throw new Error('Width descriptor must be greater than zero');
				} else if (!Number.isInteger(value)) {
					throw new TypeError('Width descriptor must be an integer');
				}

				break;
			}

			case 'x': {
				if (value <= 0) {
					throw new Error('Pixel density descriptor must be greater than zero');
				}

				break;
			}

			case 'h': {
				throw new Error('Height descriptor is no longer allowed');
			}

			default: {
				throw new Error(`Invalid srcset descriptor: ${descriptor}`);
			}
		}
	};

	function parseSrcset(string, {strict = false} = {}) {
		const allDescriptors = strict ? {} : undefined;

		return string.split(imageCandidateRegex)
			.filter((part, index) => index % 2 === 1)
			.map(part => {
				const [url, ...descriptors] = part.trim().split(/\s+/);

				const result = {url};

				if (strict) {
					descriptorCountCheck(allDescriptors, descriptors);
				}

				for (const descriptor of descriptors) {
					const postfix = descriptor[descriptor.length - 1];
					const value = Number.parseFloat(descriptor.slice(0, -1));

					if (strict) {
						validDescriptorCheck(value, postfix, descriptor);
						duplicateDescriptorCheck(allDescriptors, value, postfix);
					}

					switch (postfix) {
						case 'w': {
							result.width = value;
							break;
						}

						case 'h': {
							result.height = value;
							break;
						}

						case 'x': {
							result.density = value;
							break;
						}

						// No default
					}
				}

				return result;
			});
	}

	var rafThrottle = function rafThrottle(callback) {
	  var requestId = null;
	  var lastArgs;

	  var later = function later(context) {
	    return function () {
	      requestId = null;
	      callback.apply(context, lastArgs);
	    };
	  };

	  var throttled = function throttled() {
	    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
	      args[_key] = arguments[_key];
	    }

	    lastArgs = args;

	    if (requestId === null) {
	      requestId = requestAnimationFrame(later(this));
	    }
	  };

	  throttled.cancel = function () {
	    cancelAnimationFrame(requestId);
	    requestId = null;
	  };

	  return throttled;
	};

	var rafThrottle_1 = rafThrottle;

	function escapeStringRegexp(string) {
		if (typeof string !== 'string') {
			throw new TypeError('Expected a string');
		}

		// Escape characters with special meaning either inside or outside character sets.
		// Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
		return string
			.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
			.replace(/-/g, '\\x2d');
	}

	function trimRepeated(string, target) {
		if (typeof string !== 'string' || typeof target !== 'string') {
			throw new TypeError('Expected a string');
		}

		const regex = new RegExp(`(?:${escapeStringRegexp(target)}){2,}`, 'g');

		return string.replace(regex, target);
	}

	/* eslint-disable no-control-regex */

	function filenameReservedRegex() {
		return /[<>:"/\\|?*\u0000-\u001F]/g;
	}

	function windowsReservedNameRegex() {
		return /^(con|prn|aux|nul|com\d|lpt\d)$/i;
	}

	function stripOuter(string, substring) {
		if (typeof string !== 'string' || typeof substring !== 'string') {
			throw new TypeError('Expected a string');
		}

		if (string.startsWith(substring)) {
			string = string.slice(substring.length);
		}

		if (string.endsWith(substring)) {
			string = string.slice(0, -substring.length);
		}

		return string;
	}

	// Doesn't make sense to have longer filenames
	const MAX_FILENAME_LENGTH = 100;

	const reControlChars = /[\u0000-\u001F\u0080-\u009F]/g; // eslint-disable-line no-control-regex
	const reRelativePath = /^\.+/;
	const reTrailingPeriods = /\.+$/;

	function filenamify(string, options = {}) {
		if (typeof string !== 'string') {
			throw new TypeError('Expected a string');
		}

		const replacement = options.replacement === undefined ? '!' : options.replacement;

		if (filenameReservedRegex().test(replacement) && reControlChars.test(replacement)) {
			throw new Error('Replacement string cannot contain reserved filename characters');
		}

		string = string.normalize('NFD');
		string = string.replace(filenameReservedRegex(), replacement);
		string = string.replace(reControlChars, replacement);
		string = string.replace(reRelativePath, replacement);
		string = string.replace(reTrailingPeriods, '');

		if (replacement.length > 0) {
			string = trimRepeated(string, replacement);
			string = string.length > 1 ? stripOuter(string, replacement) : string;
		}

		string = windowsReservedNameRegex().test(string) ? string + replacement : string;
		const allowedLength = typeof options.maxLength === 'number' ? options.maxLength : MAX_FILENAME_LENGTH;
		if (string.length > allowedLength) {
			const extensionIndex = string.lastIndexOf('.');
			string = string.slice(0, Math.min(allowedLength, extensionIndex)) + string.slice(extensionIndex);
		}

		return string;
	}

	const pickerStyleLink = document.createElement('link');
	pickerStyleLink.rel = 'stylesheet';
	pickerStyleLink.href = chrome.runtime.getURL('picker.css');

	const pickerRoot = document.createElement('iframe');
	pickerRoot.classList.add('_picker-root');
	pickerRoot.src = chrome.runtime.getURL('picker-ui.html');

	let elementsToHighlight = [];
	let candidateImages = [];

	const startPicker = () => {
		document.head.append(pickerStyleLink);
		document.body.append(pickerRoot);

		window.addEventListener('message', handleMessage);
		window.addEventListener('resize', handleViewportChange);
		window.addEventListener('scroll', handleViewportChange);
	};

	const quitPicker = () => {
		pickerStyleLink.remove();
		pickerRoot.remove();

		window.removeEventListener('message', handleMessage);
		window.removeEventListener('resize', handleViewportChange);
		window.removeEventListener('scroll', handleViewportChange);
	};

	const handleMessage = (event) => {
		switch (event.data.type) {
			case 'highlightImageAtPoint': {
				highlightImageAtPoint(event.data.x, event.data.y);
				break
			}
			case 'pickImageAtPoint': {
				pickImageAtPoint(event.data.x, event.data.y);
				break
			}
			case 'unhighlightElements': {
				highlightElements([]);
				break
			}
			case 'quitPicker': {
				quitPicker();
				break
			}
			case 'startDownload': {
				startDownload();
				break
			}
		}
	};

	const handleViewportChange = rafThrottle_1(() => {
		highlightElements(elementsToHighlight);
	});

	const highlightImageAtPoint = (x, y) => {
		const element = getElementFromPoint(x, y);

		if (element.tagName === 'IMG') {
			highlightElements([element]);
		} else {
			highlightElements();
		}
	};

	const getElementFromPoint = (x, y) => {
		return document.elementsFromPoint(x, y)[1]
	};

	const highlightElements = (elements = []) => {
		elementsToHighlight = elements;

		const paths = [];

		for (const element of elements) {
			const {x, y, width, height} = element.getBoundingClientRect();
			paths.push(`M ${x} ${y} v ${height} h ${width} v -${height} z`);
		}

		setSvgPath(paths.join(' '));
	};

	const pickImageAtPoint = (x, y) => {
		const element = getElementFromPoint(x, y);

		// TODO: img 要素以外の要素にも対応
		if (element.tagName !== 'IMG') {
			return
		}

		const selector = getSelectorFromElement(element);
		candidateImages = document.querySelectorAll(selector);
		highlightElements(candidateImages);

		pausePicker();
	};

	const getSelectorFromElement = (element) => {
		const parts = [];

		while (element !== document.documentElement) {
			let part = element.localName;

			if (element.classList.length !== 0) {
				const classNames = element.classList.values();
				for (const className of classNames) {
					part += `.${className}`;
				}
			}

			if (element.id !== '') {
				const ids = element.id.split(' ').filter(id => id);
				for (const id of ids) {
					part += `#${id}`;
				}
			}

			parts.unshift(part);

			element = element.parentElement;
		}

		return parts.join(' > ')
	};

	const startDownload = () => {
		const urls = Array.from(candidateImages).map(image => getImageUrlFromElement(image)).filter(url => url);
		const title = filenamify(document.title);

		chrome.runtime.sendMessage({
			type: 'startDownload',
			urls,
			title
		});
	};

	const getImageUrlFromElement = (element) => {
		// TODO: img 要素以外の要素にも対応
		if (element.tagName === 'IMG') {
			return getImageUrlFromImage(element)
		}

		return null
	};

	const getImageUrlFromImage = (image) => {
		if (image.srcset) {
			return getHighestResolutionImageUrlFromSrcset(image.srcset)
		} else {
			return image.src
		}
	};

	const getHighestResolutionImageUrlFromSrcset = (srcsetString) => {
			const srcset = parseSrcset(srcsetString);

			let descriptor;

			if (srcset[0].hasOwnProperty('width')) {
				descriptor = 'width';
			} else if (srcset[0].hasOwnProperty('height')) {
				descriptor = 'height';
			} else if (srcset[0].hasOwnProperty('density')) {
				descriptor = 'density';
			} else {
				return null
			}

			let maxValue = 0;
			let result;

			for (const item of srcset) {
				const value = item[descriptor];

				if (value > maxValue) {
					result = item.url;
				}
			}

			return result
	};

	const setSvgPath = (path) => {
		pickerRoot.contentWindow.postMessage({
			type: 'setSvgPath',
			path
		}, '*');
	};

	const pausePicker = () => {
		pickerRoot.contentWindow.postMessage({ type: 'pausePicker' }, '*');
	};

	if (!document.querySelector('._picker-root')) {
		startPicker();
	}

})();
