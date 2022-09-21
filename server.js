const express = require('express');
const app = express();
const cors = require('cors')
const bodyParser = require('body-parser')
const port = 8080;

app.use(cors())
app.use(bodyParser.json())

const mariadb = require('mariadb');
const pool = mariadb.createPool({
    host: '34.64.125.130', 
    user:'root', 
    password: '123456789!',
    database: 'login',
    connectionLimit: 5
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

app.post('/login', (req, res) => {
    (async () => {
        //const users = asyncFunction('hh','7890')
        //res.send(users)
        const {
            ID,
            Password,
            remember
        } = req.body

        // console.log("req.body")
        // console.log(req.body)
        // asyncFunction(req.body.ID, req.body.Password)

        try {
            conn = await pool.getConnection();
            const sqlResult = await checkLoginFromDB(conn, ID, Password)
            if(sqlResult[0] == undefined){
                res.send({'msg':'아이디나 비밀번호가 틀렸습니다.'})
                console.log('아이디나 비밀번호가 틀렸습니다.')
            }
            res.send(JSON.stringify(sqlResult[0]))
            console.log('sqlResult', sqlResult[0])
            
        } catch (err) {
            console.log(err)
            res.status(500).send(err)
        }
    })()
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