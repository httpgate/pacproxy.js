//测试时Firefox设置代理localhost, 端口8080， 同时支持http和https, 不需要设pac链接

//proxy server listening port 代理服务器端口
const proxyport = 8080 ;
//proxy authorize wss url, we use ws url only for demo and testing
const wssurl = 'ws://localhost:3128/0000000000000000';

const net = require('net');
const WebSocket = require('ws');
const pacProxy = require('../pacproxy.js');

pacProxy.proxy();

const server = net.createServer(c => {
    const ws = new WebSocket(wssurl)

    ws.on('close', () => c.destroy())

    ws.on('error', () => c.destroy())

    c.on('end', () => ws.close(1000))

    c.on('error', () => ws.close(1000))

    ws.on('open', () => c.on('data', data => ws.send(data)))

    ws.on('message', data => {
      if (!c.destroyed)
        c.write(data)
    })
})


  server.on('error', (err) => {
    console.log('error');
  })

  server.listen(proxyport);

