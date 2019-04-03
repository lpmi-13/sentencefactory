const gulp = require('gulp');
const minify = require('gulp-uglify');

gulp.task('mini', done => {
  gulp.src('js/*.js')
    .pipe(minify())
    .pipe(gulp.dest('dist/'))
  done();
});

gulp.task('default', gulp.parallel(
  'mini'
  )
);
