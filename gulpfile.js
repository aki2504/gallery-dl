const gulp = require('gulp')
const { rollup } = require('rollup')
const commonjs = require('@rollup/plugin-commonjs')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const postcss = require('gulp-postcss')
const cssImport = require('postcss-import')
const zip = require('gulp-zip')

gulp.task('css', () => {
	return gulp.src('src/*.css')
		.pipe(postcss([cssImport]))
		.pipe(gulp.dest('dest'))
})

gulp.task('js', async (callback) => {
	const inputs = [
		'src/background.js',
		'src/picker.js',
		'src/picker-ui.js',
	]

	const promises = inputs.map(async (input) => {
		const bundle = await rollup({
			input,
			plugins: [commonjs(), nodeResolve()]
		})

		await bundle.write({
			dir: 'dest',
			format: 'iife'
		})
	})

	await Promise.all(promises)

	callback()
})

gulp.task('copy', () => {
	return gulp.src('src/*.{html,json,png}')
		.pipe(gulp.dest('dest'))
})

gulp.task('build', gulp.parallel('js', 'css', 'copy'))

gulp.task('dev', () => {
	gulp.watch('src/*.css', gulp.series('css'))
	gulp.watch('src/*.js', gulp.series('js'))
	gulp.watch('src/*.{html,json,png}', gulp.series('copy'))
})

gulp.task('zip', () => {
	return gulp.src('src/*')
		.pipe(zip('dest.zip'))
		.pipe(gulp.dest('./'))
})