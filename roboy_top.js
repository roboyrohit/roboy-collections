var express = require('express');
var bodyParser = require("body-parser")
var app = express();
var cors = require('cors');
var path = require("path");
const fs = require('fs');
var router = express.Router();
var mysql = require("mysql");
var connection = require("express-myconnection");
var utils = require('./src/utils/utils');

app.use(
  connection(
    mysql,
    {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'roboy',
    },
    "request"
  )
);

app.use(function (req, res, next) {
  req.querySync = (sql, params = []) => utils.MysqlPromisify(req, sql, params);
  next();
})

router.use(function (req, res, next) {
  console.log(req.method, req.url);
  next();
});

app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" })); //support x-www-form-urlencoded
app.use(bodyParser.json());
app.use(cors())

function renameKey(obj, old_key, new_key) {
  if (old_key !== new_key) {// Check if old key = new key
    Object.defineProperty(obj, new_key,// Modify old key
      Object.getOwnPropertyDescriptor(obj, old_key)); // Fetch description from object
    delete obj[old_key];// Delete old key
  }
}

var mainjs = require('./src/movies-series');

router.route("/").get(mainjs.homepage);

router.route("/reg_user").post(async function (req, res, next) {
  let data = req.body;
  console.log('Recieved From React :', data);
  let id = await utils.postMongoDB('users', data);
  console.log('Recieved From MongoDB :', id);
  res.json(JSON.stringify(id));
});

router.route("/logout").get(async function (req, res) {
  req.session.destroy();
  res.redirect('/');
});

router.route("/getSeries").get(async function (req, res, next) {
  // res.set('Access-Control-Allow-Origin', '*');
  var series = await req.querySync("SELECT * FROM series;");
  console.log('MySQL query returned :', typeof series, series.length);
  let genres = await utils.getQuery(req, "Series", "Genre", "yes");
  let origins = await utils.getQuery(req, "Series", "Origin", "yes");
  let years = await utils.getQuery(req, "Series", "Year", "no");
  let networks = await utils.getQuery(req, "Series", "Network", "no");
  series = Object.values(JSON.parse(JSON.stringify(series)));
  series.forEach(obj => {
    return renameKey(obj, 'Name', 'name'),
      renameKey(obj, 'IMDB', 'imdb'),
      renameKey(obj, 'Episodes', 'episodes'),
      renameKey(obj, 'Year', 'year'),
      renameKey(obj, 'Origin', 'origin'),
      renameKey(obj, 'Creater', 'creater'),
      renameKey(obj, 'Director', 'director'),
      renameKey(obj, 'Network', 'network'),
      renameKey(obj, 'Genre', 'genre'),
      renameKey(obj, 'Thumbnail', 'thumbnail'),
      renameKey(obj, 'imdbThumbnail', 'imdbThumb'),
      renameKey(obj, 'Wikipedia', 'wikipedia'),
      renameKey(obj, 'Bookmarked', 'isBookMark'),
      renameKey(obj, 'Liked', 'isLiked'),
      renameKey(obj, 'Watched', 'isWatched')
  });
  const data = [{ "years": years, "genres": genres, "origins": origins, "networks": networks, "series": series }];
  res.send(data)
});

router.route("/getMovies").get(async function (req, res, next) {
  // res.set('Access-Control-Allow-Origin', '*');
  var movies = await req.querySync("SELECT * FROM movies;");
  console.log('MySQL query returned :', typeof movies, movies.length);
  let ratings = await utils.getQuery(req, "Movies", "Rating", "no");
  let years = await utils.getQuery(req, "Movies", "Year", "no");
  let genres = await utils.getQuery(req, "Movies", "Genre", "yes");
  let origins = await utils.getQuery(req, "Movies", "Origin", "yes");
  let languages = await utils.getQuery(req, "Movies", "Language", "yes");
  let franchise = await utils.getQuery(req, "Movies", "Franchise", "no");
  movies = Object.values(JSON.parse(JSON.stringify(movies)));
  movies.forEach(obj => {
    return renameKey(obj, 'Name', 'name'),
      renameKey(obj, 'IMDB', 'imdb'),
      renameKey(obj, 'Rating', 'rating'),
      renameKey(obj, 'Year', 'year'),
      renameKey(obj, 'Origin', 'origin'),
      renameKey(obj, 'Director', 'director'),
      renameKey(obj, 'Genre', 'genre'),
      renameKey(obj, 'Franchise', 'franchise'),
      renameKey(obj, 'Thumbnail', 'thumbnail'),
      renameKey(obj, 'imdbThumbnail', 'imdbThumb'),
      renameKey(obj, 'Wikipedia', 'wikipedia'),
      renameKey(obj, 'Bookmarked', 'isBookMark'),
      renameKey(obj, 'Liked', 'isLiked'),
      renameKey(obj, 'Watched', 'isWatched')
  });
  // let movies = await utils.getMongoDB('roboMovies');
  // console.log('MongoDB => Type of Movies: ', typeof movies, movies.length)
  const data = [{ "ratings": ratings, "years": years, "genres": genres, "origins": origins, "languages": languages, "franchise": franchise, "movies": movies }];
  res.send(data);
});

router.route("/getIsro").get(async function (req, res, next) {
  var launches = await req.querySync("SELECT * FROM isrolaunches;");
  console.log('MySQL query returned :', typeof launches, launches.length);
  res.send(launches);
})

router.route("/movies").get(mainjs.movies);
router.route("/movies").post(mainjs.filterMovies);

router.route("/series").get(mainjs.series);
router.route("/series").post(mainjs.filterSeries);

router.route("/genre").get(mainjs.genre);

router.route("/year").get(mainjs.year);
router.route("/year").post(mainjs.filterMovSer);

router.route("/isroLaunches").get(mainjs.isroLaunches);

router.route("/isro_retired").get(mainjs.isroRetired);

var test_Mongo = router.route("/testMongoDB");
test_Mongo.get(mainjs.getMongo);
test_Mongo.post(mainjs.testMongo);

var asha_activity = router.route("/asha_activity");
asha_activity.get(mainjs.AshaActivity);
asha_activity.patch(mainjs.get_question);
asha_activity.post(mainjs.post_answers);

var question_hunt = router.route("/getquestions");

//now we need to apply our router here
app.use("/", router);

app.use(function (req, res, next) {
  return res.status(404).render("404");
});

// custom 500 page
app.use(function (err, req, res, next) {
  console.error(`${req.method} ${req.url}`, err);
  if (req.method === "GET") {
    res.type("text/html");
    res.status(500).render("500");
  } else {
    res.status(500).json({ status: 500, error: err });
  }
});

//start Server
var httpServer = app.listen(3030, () => {
  console.log("Listening to port %s", httpServer.address().port);
});

module.exports = httpServer;