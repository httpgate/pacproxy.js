#!/usr/bin/env node

//sample configs, also the default configs, change it to your settings
const configsInCode = {
	// set to false to save storage and avoid problems
	logging : true,
	// run as https server, or as http server only for testing purpose (put inside stunnel will lost client IP info)
	https : false,
	// proxy domain like your.proxy.domain
	domain : 'localhost',
	// proxy listening port, if Port Forwarding, it's Internal Port
	port : 8080,
	// proxy access port, if Port Forwarding, it's External Port
	proxyport : 8080,
	// you will share your pac link as: https://your.proxy.domain/paclink , please change it to a long random '/xxxxxxxx'
	paclink : '/0000000000000000',
	// how long this IP can access proxy since last visit（relaunch browser or reconnect to wifi to activate IP again)
	iphours : 2,
	// content of https://www.proxy.domain, style is: https://blog.ddns.com/homepage.htm. no local site for safety reason
	website :  '',
	// ssl cert file, default is ./{domain}/fullchain.pem
	cert : '',
	// ssl key file, default is ./{domain}/privkey.pem
	key : '',
    // An inner proxy listening port for websocket proxy, enabled if not 0, need to "npm install ws"
	innerport : 0,
	// Skip register proxy request event, it can be registered outside
	skiprequest : false,
	// http(s) server created outside, if empty proxy will create a http(s) server
	server : false,
	// web request handler for not proxy traffic, enable if website value is empty, by default return 403 error
	onrequest : (req, res) => {response(res,403);},
	// websocket handler for not proxy traffic, enable if innerport not 0
	onconnection : (ws, req) => { ws.close(1011, "authentication failed");},
};
/**
 * Dependencies
 */
const http = require('http');
const https = require('https');
const net = require('net');
const event = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Shared Variables
 */
this.configs = false;
this.server = false;
this.httpAgents = new Map();
this.websiteAgent =  new http.Agent({ keepAlive: true});
this.websiteParsed = false;
this.proxyClients = new Map();
this.ipMilliSeconds = 0;
this.innerServer = false;
const pacProxy = this;

/**
 * Export Module functions
 */

exports.proxy = proxy;
exports.handleRequest = handleRequest;
exports.getShareLink = getShareLink;

function proxy(configs) {
	if(!configs) configs = configsInCode;
	else merge(configs, configsInCode);

	pacProxy.configs = configs;
	pacProxy.ipMilliSeconds = pacProxy.configs.iphours * 3600 * 1000;
	if(pacProxy.configs.website) pacProxy.websiteParsed = new URL(pacProxy.configs.website);
	if(pacProxy.websiteParsed.host && isLocalHost(pacProxy.websiteParsed.host)) pacProxy.configs.website = false;
	if(!pacProxy.configs.paclink.startsWith('/')) pacProxy.configs.paclink = '/' + pacProxy.configs.paclink;

	event.EventEmitter.prototype._maxListeners = 500;
	event.defaultMaxListeners = 500;

	server = configs.server;
	if(!server) server = createServer();
	server.on('connect', handleConnect);
	if(!configs.skiprequest) server.on('request', handleRequest);

	if(!configs.server) server.listen(pacProxy.configs.port, () => {
		console.log(
			'\r\npac proxy server listening on port %d,\r\nshare your pac url:  \r\n%s\r\n',
			server.address().port, getShareLink('http')
		);
	});

	pacProxy.server = server;
	if(pacProxy.configs.innerport) initInnerServer();	
	return server;
}

function merge(vmain, vdefault){
	Object.entries(vdefault).forEach((value, key) => {
		if(!vmain[value[0]]) vmain[value[0]] = value[1];
	} ) ;
}

function initInnerServer() {
	if(pacProxy.configs.innerport==0) return;
	pacProxy.innerServer = http.createServer();
	pacProxy.innerServer.on('connect', _handleConnect);
	pacProxy.innerServer.on('request', _handleRequest);
	pacProxy.innerServer.listen(pacProxy.configs.innerport, '127.0.0.1', () => {
		console.log('\r\npac proxy server listening on port %d,\r\nshare your wss url:  \r\n%s\r\n',
		pacProxy.innerServer.address().port, getShareLink('ws'));
	});

    var WebSocket = require("ws");
    var ws = new WebSocket.Server({ server: pacProxy.server });
	ws.on("connection", handleWebsocket);
}

function gErrorHandler(e) {
	log('General Error %s ',  e.message);
}
/**
 * Start Server if configured
 */

// uncomment to run
run();

function run() {
	if(!process.argv[1].includes(__filename)) return;  //used as a module
    var configs = getConfigs();
	proxy(configs);
}

function getConfigs(){
	if(!process.argv[2]) return configsInCode;
	if(!isNaN(process.argv[2])){
		configsInCode.port = process.argv[2];
		return configsInCode;
	}

	let configPath = path.resolve(__dirname, process.argv[2]);
	let configs = require(configPath);

	if(!process.argv[3]) return configs;

	configs.port = process.argv[3]; 
	return configs;
}

function createServer() {
	if(!pacProxy.configs.https) return http.createServer();

	if(pacProxy.configs.cert && pacProxy.configs.key){
		let cert1 = path.resolve(__dirname, pacProxy.configs.cert);
		let key1 = path.resolve(__dirname, pacProxy.configs.key);
		return https.createServer({key: key1, cert: cert1});
	}

	var certDir =  __dirname
	if(process.env.CERTDIR) certDir = process.env.CERTDIR;

	let domain = pacProxy.configs.domain;
	var options = {
	  key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
	  cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
	};
	
	return https.createServer(options);
}

function getShareLink(protocal) {
	var linkDomain = protocal + (pacProxy.configs.https? 's://' : '://') + pacProxy.configs.domain;
	var linkHost = ':' + pacProxy.configs.proxyport;
	if(pacProxy.configs.https && (pacProxy.configs.proxyport == 443)) linkHost = ''; 
	if(!pacProxy.configs.https && (pacProxy.configs.proxyport == 80)) linkHost = '';
	return linkDomain + linkHost + pacProxy.configs.paclink;
}

/**
 * Shared Functions
 */
function filterHeader(reqHeaders){
	let resHeaders = reqHeaders;
	if(!reqHeaders) return resHeaders;
	if ('connection' in resHeaders) delete resHeaders['connection'];
	if ('keep-alive' in resHeaders) delete resHeaders['keep-alive'];
	if ('upgrade' in resHeaders) delete resHeaders['upgrade'];
	return resHeaders;
}

function log(...args) {
	if (pacProxy.configs && pacProxy.configs.logging) console.log(...args);
}

function pacContent() {
	proxyType = pacProxy.configs.https ? 'HTTPS' : 'PROXY' 
	pacjs = `function FindProxyForURL(url, host) { return "${proxyType} ${pacProxy.configs.domain}:${pacProxy.configs.proxyport}";}`;
	return pacjs;
}

function isLocalHost($host) {
	let $domain = ($host.split(':')[0]).trim();
	if($domain.includes('localhost') || $domain.includes('.local')) return true;
	if($domain.includes('::')) return true;  //ipv6 native ip
	if($domain.startsWith('192.') || $domain.startsWith('10.') || $domain.startsWith('172.') || $domain.startsWith('127.')) return true;
	return false;
}

function authenticate(req, res) {
	var checkIP = req.socket.remoteAddress;
	lastPacLoad = pacProxy.proxyClients.get(checkIP);
	if(!lastPacLoad) return false;
	lastVisitMilliSeconds = Date.now() - lastPacLoad; 
	pacProxy.proxyClients.set(checkIP,Date.now());
	if (lastVisitMilliSeconds < pacProxy.ipMilliSeconds) return true;	
	return false;
}

function response(res, httpCode, headers, content) {
	if(headers) res.writeHead(httpCode, headers);
	else res.writeHead(httpCode);

	if(content) res.write(content);
	res.end();
}

function socketResponse(socket, content, cb) {
	if(!cb) cb = () => socket.end();

    try {
        socket.write(content+ '\r\n', 'UTF-8', cb);
    } catch (error) {
        cb(error);
    }
}

function requestRemote(parsed, req, res) {
	var gotResponse = false;

	log('%s Fetch %s ', visitorIP, parsed);
	var agent = http;
	if(parsed.protocol == 'https:') agent = https;

	var proxyReq = agent.request(parsed, function(proxyRes) {

		var headers = filterHeader(proxyRes.headers);

		gotResponse = true;

		res.writeHead(proxyRes.statusCode, headers);
		proxyRes.pipe(res);
		res.on('finish', endRequest);

	});
	
	proxyReq.on('error', function (err) {
		if (gotResponse) return;
		else if ('ENOTFOUND' == err.code) response(res,400);
		else response(res,500);
		endRequest();
	});

	res.on('close', endRequest);
	req.socket.on('close', endRequest);
	req.socket.on('error', endRequest);

	function endRequest() {
		try{
			req.socket.end()			
			req.socket.removeListener('close', endRequest);
			proxyReq.end();
			res.removeListener('finish', endRequest);
			res.removeListener('error', endRequest);
		} catch (e) {
			log('%s Error %s ', visitorIP, e.message);
		}		
	}

	req.pipe(proxyReq);
}


/**
 * handle website requests
 */
function handleWebsite(req, res, parsed) {
    try {
		visitorIP = req.socket.remoteAddress;
		if (req.url == pacProxy.configs.paclink) {
			pacProxy.proxyClients.set(visitorIP,Date.now())
			return response(res,200,{'Content-Type': 'text/plain'},pacContent());
		}

		if(!pacProxy.configs.website) return pacProxy.configs.onrequest(req, res);
		log('%s %s %s ', visitorIP, req.headers.host, req.url);

		try{
			if(! parsed) parsed = new URL('http://'+pacProxy.configs.domain + req.url);
		} catch (e) {
			return  response(res, 403);
		}

		var headers = filterHeader(req.headers);
 	    if ((! 'host' in headers) || (headers.host.split(':')[0] != pacProxy.configs.domain))  return response(res, 500);

		if (parsed.pathname == '/') parsed.pathname = pacProxy.websiteParsed.pathname;
		parsed.protocol = pacProxy.websiteParsed.protocol;
		parsed.host = pacProxy.websiteParsed.host;
		parsed.port = pacProxy.websiteParsed.port;
		parsed.method = req.method;
		parsed.headers = headers;
		parsed.agent = pacProxy.websiteAgent;

		requestRemote(parsed, req, res);

	} catch (e) {
		log('%s Error %s ', visitorIP, e.message);
	}
}

/**
 * handle proxy http requests
 */

function handleRequest(req, res) {
	if(req.url.startsWith('/')) return handleWebsite(req, res);
	if(!authenticate(req, res)) return  response(res, 403);
	_handleRequest(req, res);
}

function _handleRequest(req, res) {
	try {
		var parsed = new URL(req.url);
	} catch (e) {
		return  response(res, 403);
	}

	if(parsed.host && (parsed.host.split(':')[0] == pacProxy.configs.domain)) return handleWebsite(req, res, parsed);
    if(isLocalHost(parsed.host)) return response(res, 403);

	visitorIP = req.socket.remoteAddress;	
	log('%s %s %s ', visitorIP, req.method, req.url);

	var headers = filterHeader(req.headers);

	parsed.method = req.method;
	parsed.headers = headers;

	// use keep-alive http agents
	var host = parsed.host;
	var agent = pacProxy.httpAgents.get(host);
	if (!agent) {
		agent =  new http.Agent({ keepAlive: true});
		pacProxy.httpAgents.set(host,agent);
	}
	parsed.agent = agent;

	if (! parsed.port) {
		parsed.port = 80;
	}

	try{	
		requestRemote(parsed, req, res);
	} catch (e) {
		log('%s Error %s ', visitorIP, e.message);
	}
};

/**
 * handle CONNECT proxy requests.
 */

function handleConnect(req, socket) {
	if(!authenticate(req, socket)) return socketResponse(socket,  'HTTP/1.1 403 Forbidden\r\n');;
	_handleConnect(req, socket);
}

function _handleConnect(req, socket) {
	if(isLocalHost(req.url)) return socketResponse(socket, 'HTTP/1.1 403 Forbidden\r\n');
    try {
		socket.on('error', gErrorHandler);

		visitorIP = req.socket.remoteAddress;
		log('%s %s %s ', visitorIP, req.method, req.url);

		var gotResponse = false;

		ontunnelerror = (err) => {
			if (gotResponse) return socket.end();
			if ('ENOTFOUND' == err.code) return socketResponse(socket, 'HTTP/1.1 404 Not Found\r\n');
			else  return socketResponse(socket, 'HTTP/1.1 500 Internal Server Error\r\n');
		}

        var ropts = {
            host: req.url.split(':')[0],
            port: req.url.split(':')[1] || 443
        };


		transfer = (error) =>  {
			try{
				gotResponse = true;
				if (error) {
					tunnel.end();
					socket.end();
					return;
				}
				tunnel.pipe(socket);
				socket.pipe(tunnel);
			} catch (e) {
				log('%s Error %s ', visitorIP, e.message);
			}
		};

		var tunnel = net.createConnection(ropts, 
			socketResponse(socket,  'HTTP/1.1 200 Connection established\r\n', transfer)
		);

		tunnel.on('error', ontunnelerror);
		tunnel.on('close', () => socket.end());
		tunnel.setNoDelay(true);
    } catch (e) {
		log('%s Error %s ', visitorIP, e.message);
    }
}

function handleWebsocket(ws, req) {
	if(req.url.trim() != pacProxy.configs.paclink) return pacProxy.configs.onconnection(ws,req);
	visitorIP = req.socket.remoteAddress;
	log('%s %s %s ', visitorIP, 'WSS', req.url);

	tolocal = { host: '127.0.0.1', port: pacProxy.configs.innerport};
	try{
		var tunnel = net.createConnection(tolocal)
		ws.on('close', () => tunnel.end());
		ws.on('error', () => tunnel.end());
		tunnel.on('end', () => ws.close(1000));
		tunnel.on('error', () => ws.close(1000));  
		tunnel.on('data', data => ws.send(data));	
		ws.on('message', data => tunnel.write(data));
	} catch (e) {
		log('%s Error %s ', visitorIP, e.message);
	}
}
