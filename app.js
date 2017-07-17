const WebSocketServer = require('ws').Server
const fs = require('fs')
const path = require('path');

let wss = new WebSocketServer({port: 9879})
let userDataDir = "./user_data"

wss.on('connection', ws => {
    let last_modified = 0
    let first_status_check = true
    ws.on('message', message => {
        let received_message = JSON.parse(message)
        let pathToUser = path.join(userDataDir, received_message['username'])
        let lastModifiedInfoforUser = path.join(pathToUser, 'last_modified.json')
        let lastModifiedInfoForUserObj = {}
        if(received_message['type'] == 'status_check') {
            console.log('Do status check')
            if(first_status_check) {
                try {
                    if(fs.existsSync(lastModifiedInfoforUser)) {
                        lastModifiedInfoForUserObj = JSON.parse(fs.readFileSync(lastModifiedInfoforUser))
                        for(appName in lastModifiedInfoForUserObj) {
                            if(appName == received_message['app_name']) {
                                last_modified = lastModifiedInfoForUserObj[appName]
                            }
                        }
                    }
                } catch(e) {
                    console.log(e)
                }
                first_status_check = false
            }
            if(last_modified == received_message['last_modified']) {
                ws.send('last_modified unchanged')
                console.log('data in sync')
            } else {
                ws.send('last_modified changed')
                console.log('data needs sync')
            }
        } else if(received_message['type'] == 'sync') {
            console.log('Do sync operation')
            let sync_sucess = createOrUpdateUser(received_message)
            if(sync_sucess) {
                console.log('data synced')
                last_modified = received_message['last_modified']
                try {
                    if(Object.keys(lastModifiedInfoForUserObj).length === 0 && fs.existsSync(lastModifiedInfoforUser)) { // populate object with existing data
                        lastModifiedInfoForUserObj = JSON.parse(fs.readFileSync(lastModifiedInfoforUser))
                    }
                    lastModifiedInfoForUserObj[received_message['app_name']] = last_modified // set new data
                    fs.writeFileSync(lastModifiedInfoforUser, JSON.stringify(lastModifiedInfoForUserObj)) // write updated obj
                } catch(e) {
                    console.log(e)
                }
                ws.send('sync success')
            } else {
                console.log('sync operation failed')
                ws.send('sync failed')
            }
        }
    })
})

function createOrUpdateUser(received_message) {
    let pathToUser = path.join(userDataDir, received_message['username'])
    let pathToAppData = path.join(pathToUser, received_message['app_name'] + '.json')
    try {
        if(!fs.existsSync(pathToUser)) {
            fs.mkdirSync(pathToUser)
        }
        if(!fs.existsSync(pathToAppData)) {
            fs.writeFileSync(pathToAppData, '{}')
        }
        fs.writeFileSync(pathToAppData, received_message['json'])
    } catch(e) {
        return false
    }
    return true
}