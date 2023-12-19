const fs = require('fs');
const path = require('path');
var utils = require('./utils/utils');

function sortarray(array, key) {
    return array.sort(function (a, b) {
        var x = a[key];
        var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

async function findUnique(array, key) {
    var unique = array.filter((e, i) => array.findIndex(a => a[key] === e[key]) === i).map((e) => e[key]);
    unique = unique.sort();
    return unique;
}

async function filteredData(array, rules) {
    return array.filter((obj) => {
        if (rules.rating && obj.Rating !== rules.rating) { return false; }
        if (rules.genre && !obj.Genre.includes(rules.genre)) { return false; }
        if (rules.origin && !obj.Origin.includes(rules.origin)) { return false; }
        if (rules.year && obj.Year !== rules.year) { return false; }
        if (rules.language && !obj.Language.includes(rules.language)) { return false; }
        if (rules.franchise && obj.Franchise !== rules.franchise) { return false; }
        if (rules.network && obj.Network !== rules.network) { return false; }
        return true;
    })
}

exports.homepage = async function (req, res, next) {
    const images = ["waving-robo.gif", "sqweeks.gif", "moving-robo.gif", "searching-robo.gif", "giphy.gif"];

    function shuffleArray(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }
    shuffleArray(images);

    res.render('home', {images});
}

exports.movies = async function (req, res, next) {
    let moviesList = await req.querySync("SELECT * FROM Movies;");
    moviesList = JSON.parse(JSON.stringify(moviesList));
    console.log('Movies From DB : ', moviesList.length);
    let ratings = await utils.getQuery(req, "Movies", "Rating", "no");
    let years = await utils.getQuery(req, "Movies", "Year", "no");
    let genres = await utils.getQuery(req, "Movies", "Genre", "yes");
    let origins = await utils.getQuery(req, "Movies", "Origin", "yes");
    let languages = await utils.getQuery(req, "Movies", "Language", "yes");
    let franchise = await utils.getQuery(req, "Movies", "Franchise", "no");
    res.render('movies', { moviesList, ratings, years, genres, origins, languages, franchise });
}

exports.filterMovies = async function (req, res, next) {
    var { rating, genre, origin, year, language, franchise } = req.body;
    let moviesList = await req.querySync("SELECT * FROM Movies;");
    moviesList = Object.values(JSON.parse(JSON.stringify(moviesList)))
    if (!rating && !genre && !origin && !year && !language && !franchise) {
        res.send(moviesList)
    } else {
        let str = {};
        if (rating) { str.rating = rating; }
        if (genre) { str.genre = genre; }
        if (origin) { str.origin = origin; }
        if (year) { str.year = year; }
        if (language) { str.language = language; }
        if (franchise) { str.franchise = franchise; }

        let filteredlist = await filteredData(moviesList, str);
        console.log('Movies Filtering Options :', typeof str, str, '\tMulti Layer Filtered Movies Data :', filteredlist.length);

        filteredlist = sortarray(filteredlist, 'Year');
        res.send(filteredlist);
    }
}

exports.series = async function (req, res, next) {
    let seriesList = await req.querySync("SELECT * FROM Series;");
    seriesList = JSON.parse(JSON.stringify(seriesList));
    console.log('Series From DB : ', seriesList.length);
    let genres = await utils.getQuery(req, "Series", "Genre", "yes");
    let origins = await utils.getQuery(req, "Series", "Origin", "yes");
    let years = await utils.getQuery(req, "Series", "Year", "no");
    let networks = await utils.getQuery(req, "Series", "Network", "no");
    res.render('series', { seriesList, years, genres, origins, networks });
}

exports.filterSeries = async function (req, res, next) {
    var { genre, origin, year, network } = req.body;
    let seriesList = await req.querySync("SELECT * FROM Series;");
    seriesList = Object.values(JSON.parse(JSON.stringify(seriesList)))
    if (!genre && !origin && !year && !network) {
        res.send(seriesList)
    } else {
        let str = {};
        if (genre) { str.genre = genre; }
        if (origin) { str.origin = origin; }
        if (year) { str.year = year; }
        if (network) { str.network = network; }

        let filteredlist = await filteredData(seriesList, str);
        console.log('Series Filtering Options :', typeof str, str, '\tMulti Layer Filtered Series Data :', filteredlist.length);

        filteredlist = sortarray(filteredlist, 'Year');
        res.send(filteredlist);
    }
}

exports.genre = async function (req, res, next) {
    let moviesList = await req.querySync("SELECT * FROM Movies;");
    moviesList = JSON.parse(JSON.stringify(moviesList));
    let moveisgenres = await utils.getQuery(req, "Movies", "Genre", "yes");

    let seriesList = await req.querySync("SELECT * FROM series;");
    seriesList = Object.values(JSON.parse(JSON.stringify(seriesList)))
    let seriesgenres = await utils.getQuery(req, "Series", "Genre", "yes");

    let genres = seriesgenres.concat(moveisgenres);
    genres = genres.filter((item, index) => genres.indexOf(item) === index).sort();
    var movseries = seriesList.concat(moviesList);
    res.render('genre', { genres, movseries });
}

exports.isroLaunches = async function (req, res, next) {
    res.render('isro');
}

exports.isroRetired = async function (req, res, next) {
    res.render('retired');
}

exports.year = async function (req, res, next) {
    let moviesList = await req.querySync("SELECT * FROM Movies;");
    moviesList = JSON.parse(JSON.stringify(moviesList));
    let moveisyears = await utils.getQuery(req, "Movies", "Year", "no");

    let seriesList = await req.querySync("SELECT * FROM series;");
    seriesList = Object.values(JSON.parse(JSON.stringify(seriesList)))
    let seriesyears = await utils.getQuery(req, "Series", "Year", "no");

    let years = seriesyears.concat(moveisyears);
    years = years.filter((item, index) => years.indexOf(item) === index).sort();
    var movseries = seriesList.concat(moviesList);
    movseries = sortarray(movseries, 'Name');
    res.render('year', { years, movseries });
}

exports.filterMovSer = async function (req, res, next) {
    var { year } = req.body;
    let moviesList = await req.querySync("SELECT * FROM movies;");
    moviesList = JSON.parse(JSON.stringify(moviesList));

    let seriesList = await req.querySync("SELECT * FROM series;");
    seriesList = Object.values(JSON.parse(JSON.stringify(seriesList)))
    var movseries = seriesList.concat(moviesList);
    movseries = sortarray(movseries, 'Name');
    // console.log("Movies :" + typeof moviesList)
    if (year != "") {
        var filteredlist = await movseries.filter(file => { return file.Year === year })
        filteredlist = sortarray(filteredlist, 'Year');
        res.send(filteredlist);
    } else {
        res.send(movseries)
    }
}

exports.getMongo = async function (req, res, next) {
    res.render('mongoDB');
}

exports.AshaActivity = async function (req, res, next) {
    res.render('asha_activity');
}

exports.get_question = async function (req, res, next) {
    try {
        var { fname, lname, lapRAM, mobRAM, tookTime } = req.body;

        // console.log(data.length);
        var data = require('../public/MockData/activity.json');
        var RAMlap = data[lapRAM].lapRAM;
        var RAMmob = data[lapRAM].paperSets[mobRAM].mobRAM;

        var paper;

        if (fname === 'Rohit' && lname === 'Mehra') {
            paper = require('../public/MockData/activityMain.json');
        } else {
            paper = data[lapRAM].paperSets[mobRAM].paper;
        }

        var userdata = { "UserName": fname + ' ' + lname, "Laptop RAM": RAMlap + 'GB', "Mobile RAM": RAMmob + 'GB', "Time": tookTime + ' Minutes' }

        console.log('UserData :' + JSON.stringify(userdata));
        // console.log("Paper : ", paper.length);

        var resopnse = { "fname": fname, "lname": lname, "lapRAM": RAMlap, "mobRAM": RAMmob, "paperSet": paper }
        res.send(resopnse);
    } catch (error) {
        console.log(error);
        res.send('err');
    }
}

exports.post_answers = async function (req, res, next) {

    try {
        var { userName, lapRAM, mobRAM, response, tookTime } = req.body
        // console.log('Submitted Data :', req.body);
        lapRAM = lapRAM.replace('GB', '');
        mobRAM = mobRAM.replace('GB', '');
        var lapKey = [{ key: '0', RAM: '4' }, { key: '1', RAM: '8' }];
        var lapValue = (lapKey.find(({ RAM }) => RAM === lapRAM)).key;
        var mobKey = [{ key: '0', RAM: '2' }, { key: '1', RAM: '3' }, { key: '2', RAM: '4' }, { key: '3', RAM: '6' }, { key: '4', RAM: '8' }];
        var mobValue = (mobKey.find(({ RAM }) => RAM === mobRAM)).key;

        // console.log(lapRAM, lapValue, mobRAM, mobValue);

        var data = require('../public/MockData/activity.json');
        var paper = data[lapValue].paperSets[mobValue].paper;

        var correct = 0, wrong = 0, attempted = 0, notattempted = 0;

        var answerkey = []

        for (var i = 0; i < response.length; i++) {
            var status;
            // console.log('User Answer :', response[i].pickans, 'Correct Answer : ', paper[i].answer);

            if (response[i].pickans == "") {
                notattempted++; status = 'Not Attempted';
            } else {
                attempted++;
                if (response[i].pickans == paper[i].answer) {
                    // console.log('Correct');
                    correct++; status = 'Correct';
                } else {
                    // console.log('Wrong');
                    wrong++; status = 'Wrong';
                }
            }

            answerkey.push({
                "question": response[i].question,
                "status": status,
                "pickAns": response[i].pickans,
                "corrAns": paper[i].answer
            })
        }

        // console.log(answerkey);

        // var test = req.querySync("SELECT * FROM asha_activity WHERE UserName = ?;", [userName]);
        // if (test) {
        //     console.log("Already Attempted");
        //     res.send('duplicate');
        // } else {
        await req.querySync("INSERT INTO asha_activity (UserName, LapRAM, MobRAM, TakenTime, Correct, Wrong, NotAttempt) VALUES ('" + userName + "', '" + lapRAM + "', '" + mobRAM + "', '" + tookTime + "', '" + correct + "', '" + wrong + "', '" + notattempted + "'); ");
        var resopnse = { "username": userName, "lapRAM": lapRAM, "mobRAM": mobRAM, "tookTime": tookTime, "correct": correct, "wrong": wrong, "notAttempt": notattempted, "answerKey": answerkey }
        res.send(resopnse);
        // }

    } catch (error) {
        console.log(error);
        res.send('err');
    }
}

exports.testMongo = async function (req, res, next) {
    let data = req.body;
    console.log('Data Length :', data);
    await utils.postMongoDB('InsertTest', data);
    res.send(data);
}