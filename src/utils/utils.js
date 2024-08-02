var mongo = require("mongodb");
const MongoClient = mongo.MongoClient;
const TwoFactor = new (require('2factor'))("null" || '');

const bcrypt = require("bcrypt");
const saltRounds = 10;

/* Mysql query promisified */
function getConnectionPromisify(req) { return new Promise(function (resolve, reject) { req.getConnection((err, conn) => (err ? reject(err) : resolve(conn))); }); }

function genOTP(digits = 6) {

    let startRange = Number("1".padEnd(digits, 0)), endRange = Number("9".padEnd(digits, 0));

    return Math.floor(Math.random() * endRange) + startRange;
}

async function sendOTP(phoneNo, otp) {
    if (typeof phoneNo === "number") { phoneNo = `${phoneNo}` }

    try {
        let status = await TwoFactor.sendOTP(phoneNo, { otp });
        console.log('OTP Status:', { 'Phone Number': phoneNo, status })

        return status;
    } catch (error) {
        return true;// throw error;
    }
}

const userTypes = [    //should be ordered from low level to top level
    'General User',
    'Admin'
]

/**
 * Check if user has valid permission
 * @param {string} minimumRole
 * @param {{disable403Warning: boolean }} [options]
 *
 * @enum {string} ADMIN, VOLUNTEER-EDIT, VOLUNTEER-VIEW, ASHA TEACHER, GENERAL USER
 * @returns {boolean} whether user has permission or not
 *
 * @example
 * let granted = req.checkPermission('ADMIN', { options })
 * if(!granted){
 *  return;
 * }
 */

exports.CheckPermission = (minimumRole, options) => {
    let { req, res } = options,
        { LoginID, Type: userRole } = req.session,
        userRoleID = userTypes.indexOf(userRole),
        minimumRoleID = userTypes.indexOf(minimumRole);

    let granted = userRoleID >= minimumRoleID;

    if (minimumRoleID < 0) { throw new Error(`Provided User-Role is not defined, ${minimumRole}`); }

    if (!granted && !options.disable403Warning) {
        console.log("Access Denied for LoginID: ", LoginID);
        if (req.method === "GET") {
            res.type("text/html");
            res.status(403).render("403");
        } else {
            res.status(403).json({ error: 'Access denied!' });
        }
    }
    return granted;
}

exports.MysqlPromisify = async function (req, sql, params) {
    if (!req.DBConnection) {
        return getConnectionPromisify(req)
            .then(conn => { req.DBConnection = conn; return exports.MysqlPromisify(req, sql, params) })
            .catch(err => { throw err })
    }

    return new Promise(function (resolve, reject) { req.DBConnection.query(sql, params, (err, result) => { err ? reject(err) : resolve(result) }); });
}

exports.getQuery = async function (req, table, key, split) {
    sql = `SELECT DISTINCT ${key} FROM ${table} WHERE ${key} != '' ORDER BY ${key} ASC;`
    let result = await req.querySync(sql);
    result = JSON.parse(JSON.stringify(result)).map(obj => { return obj[key]; });
    if (split === "yes") {
        result = result.join(", ").split(", ");
        result = result.filter((item, index) => result.indexOf(item) === index).sort();
    }
    // console.log('MySQL Data Returned For', key, 'in', table, ':', result.length);
    return result;
}

exports.get_reg_user = async function (req, res, next) {
    res.render('register');
}

exports.post_reg_user = async function (req, res, next) {

    let { fname, lname, email, phone, pswrd } = req.body;

    pswrd = await bcrypt.hash(pswrd, saltRounds);

    try {
        let otp = genOTP();
        console.log('Generated OTP :', otp);
        await sendOTP(phone, otp);

        let [result] = await req.querySync('SELECT isActive FROM users WHERE Email = ? OR Phone = ? ', [email, phone]);

        if (result) { return res.status(200).json({ success: false, message: 'Email ID or Phone Number Already Registered..!' }); }

        let sql, params;
        if (email === "") {
            sql = `INSERT INTO Users (FirstName, LastName, Phone, Password, TypeID, isActive) VALUE (?, ?, ?, ?, ?, ?)`
            params = [fname, lname, phone, pswrd, 2, 1]
        } else {
            sql = `INSERT INTO Users (FirstName, LastName, Email, Phone, Password, TypeID, isActive) VALUE (?, ?, ?, ?, ?, ?, ?)`
            params = [fname, lname, email, phone, pswrd, 2, 1]
        }

        result = await req.querySync(sql, params);

        return res.status(200).json({ success: true });

    } catch (error) { return next(error); }

    // try {
    //     let otp = genOTP(), result;

    //     result = await req.querySync('SELECT true FROM users WHERE email_id = ? OR mobile = ?', [email, mobile]);

    //     if (result.length > 0) { return res.status(200).json({ rVal: 2 }); }

    //     if (email === "") {
    //         result = await req.querySync(`INSERT INTO users (firstname, lastname, mobile) VALUE (?, ?, ?))`, [firstname, lastname, mobile, school]);
    //     } else {
    //         result = await req.querySync(`INSERT INTO users (firstname, lastname, email_id, mobile) VALUE (?, ?, ?, ?)`, [firstname, lastname, email, mobile, school]);
    //     }

    //     req.session.tempID = result.insertId;

    //     result = await req.querySync('INSERT INTO otp (user_id, passkey) VALUE (?, ?)', [result.insertId, otp])

    //     await sendOTP(mobile, otp);

    //     return res.json({ rVal: 1, uid: result.insertId });

    // } catch (err) { return next(err); }
}

exports.get_user_profile = async function (req, res, next) {
    let { session } = req;
    if(!session.LoginID) { res.render('403')};
    var userDetails =  await req.querySync('SELECT FirstName, LastName, Email, Phone FROM users WHERE UserID = ?;', [session.LoginID])
    userDetails = JSON.parse(JSON.stringify(userDetails))[0];
    // console.log('User Details :', userDetails);
    res.render('profile', { session, userDetails });
}

exports.reg_user_mongodb = async function (req, res, next) {
    let data = req.body;
    console.log('Recieved From React :', data);
    let id = await utils.postMongoDB('users', data);
    console.log('Recieved From MongoDB :', id);
    res.json(JSON.stringify(id));
}

exports.login = (req, res, next) => {
    var { LoginID, Password } = req.body;

    if (!LoginID || !Password) { return res.status(422).json({ status: 422, error: true, message: "Missing Arguments" }); }

    let sql = `SELECT U.UserID, U.FirstName, U.LastName, U.Password, T.TypeValue FROM users U LEFT JOIN UserTypes T ON U.TypeID = T.TypeID WHERE U.Email = ? OR U.Phone = ?`;

    req.querySync(sql, [LoginID, LoginID])
        .then(([result]) => {
            if (!result) { return res.json({ success: false, message: "Incorrect Email ID or Phone No!" }); }

            bcrypt.compare(Password, result.Password)
                .then((valid) => {
                    // console.log(valid);
                    if (valid) {
                        req.session.LoginID = result.UserID;
                        req.session.LoginName = result.FirstName + " " + result.LastName;
                        req.session.Type = result.TypeValue;
                        // console.log("Session Data : ", req.session);
                        return res.json({ success: true });
                    } else {
                        return res.json({ success: false, message: 'Incorrect Password' });
                    }
                })
        })
        .catch(err => next(err));
}

exports.logout = function (req, res, next) {
    req.session.destroy(function (err) { if (err) next(err); return res.redirect("/"); });
}

exports.get_frgt_pswrd = async function (req, res, next) {
    res.render('forgot_password');
}

exports.post_frgt_pswrd = async function (req, res, next) {
    let { user_id, pswrd } = req.body;

    try {
        let [result] = await req.querySync('SELECT UserID FROM users WHERE Email = ? OR Phone = ?;', [user_id, user_id]);
        if (!result) { return res.status(200).json({ success: false, message: "Unregsitered Email ID or Phone No!" }); }
        var ID = (JSON.parse(JSON.stringify(result))).UserID;

        // console.log('Before :', pswrd)
        pswrd = await bcrypt.hash(pswrd, saltRounds);
        // console.log('After :', pswrd)

        await req.querySync('UPDATE users SET Password = ? WHERE UserID = ?;', [pswrd, ID])
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log("Error :", err);
        return next(err);
    }
}

exports.change_pswrd = async function (req, res, next) {
    let { user_id, curpswrd, pswrd } = req.body;
    // console.log(req.body);
    try {
        let [result] = await req.querySync('SELECT Password FROM users WHERE UserID = ? OR UserID = ?;', [user_id, user_id]);
        var prePswrd = (JSON.parse(JSON.stringify(result))).Password;
        let valid = await bcrypt.compare(curpswrd, prePswrd);
        // console.log('Validity :', valid);
        if (valid) {
            pswrd = await bcrypt.hash(pswrd, saltRounds);
            await req.querySync('UPDATE users SET Password = ? WHERE UserID = ?;', [pswrd, user_id]);
            return res.status(200).json({ success: true });
        } else {
            return res.status(200).json({ success: false, message: "Please enter your old Password!" });
        }
        // console.log('Before :', prePswrd)
    } catch (err) {
        console.log("Error :", err);
        return next(err);
    }
}

exports.getMongoDB = async (collection) => {
    let data;
    const client = await MongoClient.connect('mongodb://localhost:27017');
    let db = client.db('Roboy');
    if (!db) {
        console.log('Some Problem Ouccered. Mongo DB not Connected!!');
        return;
    }
    // console.log('Mongo DB Connected!!')
    data = db.collection(collection).find({});
    data = await data.toArray();
    return data;
}

exports.postMongoDB = async (coll, arr) => {
    const client = await MongoClient.connect('mongodb://localhost:27017');
    let db = client.db('Roboy');
    if (!db) {
        console.log('Some Problem Ouccered. Mongo DB not Connected!!');
        return;
    }

    db.collection(coll).insertOne(arr, function (err) {
        console.log('Error while inserting :', err);
        return err;
    });
    let result = await db.collection(coll).findOne(arr);
    return result;
}
