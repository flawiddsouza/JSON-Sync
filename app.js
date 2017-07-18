const WebSocketServer = require('ws').Server
const fs = require('fs')
const path = require('path');

let wss = new WebSocketServer({port: 9879})
let userDataDir = "./user_data"

DEBUG = false
function debug_log() {
    if(DEBUG) {
        console.log.apply(this, arguments)
    }
}

wss.on('connection', ws => {
    let lastModified = 0
    let firstStatusCheck = true
    ws.on('message', message => {
        let receivedMessage = JSON.parse(message)
        let pathToUser = path.join(userDataDir, receivedMessage['username'])
        let lastModifiedInfoforUser = path.join(pathToUser, 'lastModified.json')
        let lastModifiedInfoForUserObj = {}
        let pathToAppData = path.join(pathToUser, receivedMessage['appName'] + '.json')
        switch(receivedMessage['type']) {
            case 'status_check':
                debug_log('Do status check')
                if(firstStatusCheck) {
                    try {
                        if(fs.existsSync(lastModifiedInfoforUser)) {
                            lastModifiedInfoForUserObj = JSON.parse(fs.readFileSync(lastModifiedInfoforUser, 'utf8'))
                            for(appName in lastModifiedInfoForUserObj) {
                                if(appName == receivedMessage['appName']) {
                                    lastModified = lastModifiedInfoForUserObj[appName]
                                }
                            }
                        }
                    } catch(e) {
                        debug_log(e)
                    }
                    firstStatusCheck = false
                }
                if(lastModified == receivedMessage['lastModified']) { // local lastModified == server lastModified
                    ws.send(JSON.stringify({ message: 'data in sync' }))
                    debug_log('data in sync')
                } else if(lastModified < receivedMessage['lastModified']) { // local lastModified > server lastModified
                    ws.send(JSON.stringify({ message: 'server data needs sync' }))
                    debug_log('server data needs sync')
                } else if(lastModified > receivedMessage['lastModified']) { // local lastModified < server lastModified
                    ws.send(JSON.stringify({ message: 'client data needs sync' }))
                    debug_log('client data needs sync')
                }
                break;
            case 'server_sync':
                debug_log('Do server sync operation')
                let sync_sucess = createOrUpdateUser(receivedMessage)
                if(sync_sucess) {
                    debug_log('server data synced')
                    lastModified = receivedMessage['lastModified']
                    try {
                        if(Object.keys(lastModifiedInfoForUserObj).length === 0 && fs.existsSync(lastModifiedInfoforUser)) { // populate object with existing data
                            lastModifiedInfoForUserObj = JSON.parse(fs.readFileSync(lastModifiedInfoforUser, 'utf8'))
                        }
                        lastModifiedInfoForUserObj[receivedMessage['appName']] = lastModified // set new data
                        fs.writeFileSync(lastModifiedInfoforUser, JSON.stringify(lastModifiedInfoForUserObj)) // write updated obj
                    } catch(e) {
                        debug_log(e)
                    }
                    ws.send(JSON.stringify({ message: 'server sync success' }))
                } else {
                    debug_log('server sync operation failed')
                    ws.send(JSON.stringify({ message: 'server sync failed' }))
                }
                break;
            case 'client_sync':
                // Fullfilling this is left to the client app's discretion, it can even ignore to do so - nothing here will break
                // The client app must set a new lastModified date once it has merged the data from the server by resolving
                // any conflicts it finds between its data and the server sent data. This way the conflict merged data can be synced back to the server.
                // That's why we don't send a lastModified date here
                debug_log('Do client sync operation')
                try {
                    if(fs.existsSync(pathToAppData)) {
                        ws.send(JSON.stringify({ message: 'client sync', json: fs.readFileSync(pathToAppData, 'utf8') }))
                        debug_log('client data synced')
                    } else {
                        debug_log('client sync operation failed - AppData missing')
                        ws.send(JSON.stringify({ message: 'client sync failed' }))
                    }
                } catch(e) {
                    debug_log('client sync operation failed - AppData read error')
                    ws.send(JSON.stringify({ message: 'client sync failed' }))
                }
                break;
        }
    })
})

function createOrUpdateUser(receivedMessage) {
    let pathToUser = path.join(userDataDir, receivedMessage['username'])
    let pathToAppData = path.join(pathToUser, receivedMessage['appName'] + '.json')
    try {
        if(!fs.existsSync(pathToUser)) {
            fs.mkdirSync(pathToUser)
        }
        if(!fs.existsSync(pathToAppData)) {
            fs.writeFileSync(pathToAppData, '{}')
        }
        fs.writeFileSync(pathToAppData, receivedMessage['json'])
    } catch(e) {
        return false
    }
    return true
}