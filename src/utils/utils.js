var mongo = require("mongodb");
const MongoClient = mongo.MongoClient;
const TwoFactor = new (require('2factor'))("null" || '');


/* Mysql query promisified */
function getConnectionPromisify(req) {
    return new Promise(function (resolve, reject) {
        req.getConnection((err, conn) => (err ? reject(err) : resolve(conn)));
    });
}

exports.MysqlPromisify = async function (req, sql, params) {
    if (!req.DBConnection) {
        return getConnectionPromisify(req)
            .then(conn => {
                req.DBConnection = conn;
                return exports.MysqlPromisify(req, sql, params)
            })
            .catch(err => {
                throw err
            })
    }

    return new Promise(function (resolve, reject) {
        req.DBConnection.query(sql, params, (err, result) => {
            err ? reject(err) : resolve(result)
        }
        );
    });
}

exports.getQuery = async function (req, table, key, split) {
    sql = `SELECT DISTINCT ${key} FROM ${table} WHERE ${key} != '' ORDER BY ${key} ASC;`
    let result = await req.querySync(sql);
    result = JSON.parse(JSON.stringify(result)).map(obj => { return obj[key]; });
    if (split === "yes") {
        result = result.join(", ").split(", ");
        result = result.filter((item, index) => result.indexOf(item) === index).sort();
    }
    console.log('MySQL Data Returned For', key, 'in', table, ':', result.length);
    return result;
}

function genOTP(digits = 6) {

    let startRange = Number("1".padEnd(digits, 0)),
        endRange = Number("9".padEnd(digits, 0));

    return Math.floor(Math.random() * endRange) + startRange;
}

async function sendOTP(phoneNo, otp) {
    if (typeof phoneNo === "number") {
        phoneNo = `${phoneNo}`
    }

    try {
        let status = await TwoFactor.sendOTP(phoneNo, { otp });

        console.log('OTP Status:', { 'Phone Number': phoneNo, status })

        return status;
    } catch (error) {
        return true;
        // throw error;
    }
}

exports.Register_client = async function (req, res, next) {

    let { firstname, lastname, school, mobile, email } = req.body;

    try {

        let otp = genOTP(), result;

        result = await req.querySync('SELECT true FROM users WHERE email_id = ? OR mobile = ?', [email, mobile]);

        if (result.length > 0) {
            return res.status(200).json({ rVal: 2 });
        }


        if (email === "") {
            let sql = `INSERT INTO users (firstname, lastname, mobile) VALUE (?, ?, ?))`;

            result = await req.querySync(sql, [firstname, lastname, mobile, school]);
        }
        else {
            let sql = `INSERT INTO users (firstname, lastname, email_id, mobile) VALUE (?, ?, ?, ?)`;

            result = await req.querySync(sql, [firstname, lastname, email, mobile, school]);
        }

        req.session.tempID = result.insertId;

        result = await req.querySync('INSERT INTO otp (user_id, passkey) VALUE (?, ?)', [result.insertId, otp])

        await sendOTP(mobile, otp);

        return res.json({ rVal: 1, uid: result.insertId });

    }
    catch (err) {
        return next(err);
    }
}

exports.logout = function (req, res, next) {
    req.session.destroy(function (err) {
        if (err) next(err);
        return res.redirect("/");
    });
};

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