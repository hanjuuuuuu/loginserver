const express = require('express');
const cors = require('cors')
const bodyParser = require('body-parser')
const port = 8091;

const session = require('express-session');
const LokiStore = require('connect-loki')(session);
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const router = express.Router();


const app = express();
app.use(cors({
    origin : true,
    credentials : true
}));

app.use(express.static('public'))   // 정적 파일 제공
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
const { default: axios } = require('axios');
const pool = mariadb.createPool({
    host: '34.64.125.130', 
    user:'root', 
    password: '123456789!',
    database: 'login',
    connectionLimit: 30
});

const google = {
    clientID: '738653071796-55p1gacvo530c29mrkdajf12fi44nnkg.apps.googleusercontent.com',
    clientSecret: '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'
}
const kakao = {
    clientID: 'e7f0a2350af00b6762aba9343b42f7b2',
    redirectUri: 'http://localhost:8091/auth/kakao/callback',
    tokenApiUrl: "https://kauth.kakao.com/oauth/token",
    grant_type: "authorization_code",
    logoutUri: 'http://localhost:8091/auth/kakao/logout'
}
const naver = {
    clientID:'vX4A7h0O5FfuRH_3wyPn',
    redirectUri: 'http://localhost:8091/auth/naver/callback',

}


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

var checkLoginFromDB = (conn, id, pw) => {
    return new Promise(
        async (resolve, reject) => {
            const sql = "SELECT * FROM user WHERE ID =? AND PW =?; "
            rows = await conn.query(sql,[id, pw]);
            //console.log('rows', rows)
            resolve(rows);
        }
    )
} 

app.get('/logincheck', function (req, res){
    console.log('check')
    //console.log(req.session)        // cookie: { path: '/', _expires: null, originalMaxAge: null, httpOnly: true }
    console.log(req.session.is_logined)
    if(req.session.is_logined != true){
        console.log("로그인 안된 경우");
    }
    else{
        res.send(req.session.is_logined);
        //console.log(req.session.cookie)     //{ path: '/', _expires: null, originalMaxAge: null, httpOnly: true }
        console.log('user', req.cookies.is_logined)     //user s:T23_ZjWPdrFGyCa1zUO7nxR6g4y_2a7L.gNUUygnZgfYYr1cq/74P7h4SSDmsKftTD77u0kSEJaU

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
    //res.clearCookie('is_logined');
    //res.cookie('is_logined','',{maxAge:0});
    req.session.destroy(); 
    const html = `<html>
                        <script>
                            function gotoMain() {
                                window.location = 'http://localhost:8091'
                            }
                            gotoMain();
                        </script>
                    </html>`
    res.send(html);
})

app.get('/auth/kakao/callback', function (req, res, next) {     //인가코드를 카카오 서버로 보내고 유효 토큰을 받는다.
    console.log('kakao');
    let code = req.query.code;
    console.log('code',code);
    try{
        axios.post(     //토큰 요청
            `${kakao.tokenApiUrl}?grant_type=${kakao.grant_type}&client_id=${kakao.clientID}&redirect_uri=${kakao.redirectUri}&code=${code}`
            , {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
        }).then((result)=>{     //토큰
            console.log('token');
            console.log(result.data['access_token']);

            //토큰을 통해서 유저 정보 받아오기
            axios.get('https://kapi.kakao.com/v2/user/me', {
                headers: {
                    Authorization: `Bearer ${result.data.access_token}`
                }
            }).then((response) => { 
            console.log('유저 정보');
            console.log(response.data);
            req.session.is_logined = true;
            req.session.nickname = response.data.kakao_account.email;
            cookieOptions.maxAge = 3600000;     //1시간
            //res.cookie('is_logined', response.data.kakao_account.email, cookieOptions);
        
            const html = `<html>
                            <script>
                                function gotoMain() {
                                    window.location = 'http://localhost:8091'
                                }
                                gotoMain();
                            </script>
                        </html>`
            res.send(html);

            }).catch(error => {
                console.log(error);
            })
            
        }).catch(e=> {
            console.log(e);
        })
    }catch(e){
        console.log(e);
        
    }
})

// app.get('auth/kakao/logout',  function (req, res) {
//     const html = `<html>
//                             <script>
//                                 function gotoMain() {
//                                     window.location = 'http://localhost:8091'
//                                 }
//                                 gotoMain();
//                             </script>
//                         </html>`
//             res.send(html);

// } )



app.listen(port, () => console.log(`Server is running on port ${port}...`));
