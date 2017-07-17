if(localStorage.getItem('lastModified') == null) {
    localStorage.setItem('lastModified', 0)
}

let auth = {
    username: 'sample-user',
    app_name: 'My App',
    server: 'localhost:9879'
}

let socket = new WebSocket('ws://' + auth['server'])

socket.addEventListener('open', e => {
    setInterval(() => {
        socket.send(JSON.stringify({
            'type': 'status_check',
            'username': auth['username'],
            'app_name': auth['app_name'],
            'last_modified': localStorage.getItem('lastModified')
        }))
    }, 5000)
})

socket.addEventListener('message', e => {
    switch(e.data) {
        case 'last_modified unchanged':
            // console.log('data in sync')
            break
        case 'last_modified changed':
            // console.log('data needs sync')
            localStorage.setItem('lastModified', new Date().getTime())
            socket.send(JSON.stringify({
                'type': 'sync',
                'username': auth['username'],
                'app_name': auth['app_name'],
                'json': '{ "test" : "testing"}',
                'last_modified': localStorage.getItem('lastModified')
            }))
            break
    }
})