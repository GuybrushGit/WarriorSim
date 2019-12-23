var gulp = require('gulp');
var cssnano = require('gulp-cssnano');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var browser = require('browser-sync').create();

gulp.task('sass', function(){
   return gulp.src('scss/style.scss')
      .pipe(sass())
      .pipe(cssnano())
      .pipe(gulp.dest('dist/css'));
});

gulp.task('watch', function(){
    gulp.watch('scss/*.scss', ['sass']);
});

gulp.task('browser', function() {
    browser.init({
        server: {
            baseDir: "./"
        }
    });
});

gulp.task('default', ['sass', 'watch', 'browser']);