const express = require('express');
const cors = require('cors')
const bodyParser = require('body-parser')
const port = 8080;

const session = require('express-session');
const LokiStore = require('connect-loki')(session);
const cookie = require('cookie');
const cookieParser = require('cookie-parser')
const router = express.Router()


const app = express();
app.use(cors({
    origin : true,
    credentials : true
}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
    key: 'is_logined',
    store: new LokiStore(),
    secret: '@#$mycookie$#@',
    resave: false,      
    saveUninitialized: true,     //uninitialized session 저장
}));

const cookieOptions = {
    domain: 'localhost',
    path: '/',
    sameSite: 'none',
    httpOnly: true,
    secure: true,       //https 프로토콜에서만 쿠키 전송 가능
}

const mariadb = require('mariadb');
const { request } = require('express');
const pool = mariadb.createPool({
    host: '34.64.125.130', 
    user:'root', 
    password: '123456789!',
    database: 'login',
    connectionLimit: 10
});


async function asyncFunction(id, pw) {
    let conn;
    let rows;
    try {
        conn = await pool.getConnection();
        console.log("connection")

        rows = await conn.query("SELECT * FROM user");
        console.log("rows")
        console.log(rows); 

        const res = await conn.query("INSERT INTO user (id,pw) VALUES(?, ?)", [id, pw]);
        console.log("insert")
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release()
        return rows;
    }

}


app.get('/logincheck', function (req, res){
    console.log('check')
    //console.log(req.session)        // cookie: { path: '/', _expires: null, originalMaxAge: null, httpOnly: true }
    if(!req.cookies.is_logined){
        console.log("로그인 안된 경우")
    }
    else{
        res.send(req.cookies.is_logined)
        //console.log(req.session.cookie)     //{ path: '/', _expires: null, originalMaxAge: null, httpOnly: true }
        console.log('user', req.cookies.is_logined)

        console.log("로그인 된 경우")
    }
   // console.log(req.headers.cookie)
})

app.post('/login', (req, res) => {
    (async () => {
        //const users = asyncFunction('hh','7890')
        //res.send(users)
        const {
            ID,
            Password,
            remember
        } = req.body

       // console.log(req.body)       //{ ID: 'hanju', Password: '1234', remember: true }
        //console.log(req.session)        //cookie: { path: '/', _expires: null, originalMaxAge: null, httpOnly: true }
        // asyncFunction(req.body.ID, req.body.Password)

        try {
            conn = await pool.getConnection();
            const sqlResult = await checkLoginFromDB(conn, ID, Password)
            if(req.cookies.is_logined) {
                //로그인 유저가 존재하는 경우
                res.send(JSON.stringify(sqlResult[0]))
                console.log("이미 로그인 되어있습니다.")
            }else{

            if(sqlResult[0] == undefined){      //로그인 실패
                res.send({'msg':'아이디나 비밀번호가 틀렸습니다.'})
                console.log('아이디나 비밀번호가 틀렸습니다.')
            }
            else if(req.body.remember == true){     //로그인 성공(로그인 유지)
                console.log('로그인 유지');
                cookieOptions.maxAge = 3600000;     //1시간
                req.session.is_logined = true;
                req.session.nickname = sqlResult[0].ID;
                res.cookie('is_logined', sqlResult[0].ID, cookieOptions);  
                res.send(JSON.stringify(sqlResult[0]))
            }
            else{       //로그인 성공했을 경우(유지 안함)
                req.session.is_logined = true;
                req.session.nickname = sqlResult[0].ID;     
                res.cookie('is_logined', sqlResult[0].ID, cookieOptions);
                res.send(JSON.stringify(sqlResult[0]));
                //console.log('sqlResult', sqlResult[0])          //sqlResult { ID: 'hanju', PW: '1234' }
            }
        }
            
        } catch (err) {
            console.log(err)
            res.status(500).send(err)
        }
    })()
})

app.post('/logout', (req, res) => {
    console.log('logout');
        res.clearCookie('is_logined',cookieOptions);
        //res.cookie('is_logined','',{maxAge:0});
        req.session.destroy();      
        res.redirect('/');
    
})

app.listen(port, () => console.log(`Server is running on port ${port}...`));


var checkLoginFromDB = (conn, id, pw) => {
    return new Promise(
        async (resolve, reject) => {
            const sql = "SELECT * FROM user WHERE ID =? AND PW =?; "
            rows = await conn.query(sql,[id, pw]);
            //console.log('rows', rows)
            resolve(rows)
        }
    )
} 