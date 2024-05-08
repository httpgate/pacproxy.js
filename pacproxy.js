#!/usr/bin/env node

//sample configs, also the default configs, change it to your settings
const configsInCode = {
	// set to false to save storage and avoid problems
	logging : true,

	// run as https server, or as http server only for testing purpose
	// set to true if a https tunnel/reverse-proxy runs in front of this http service
	https : false,

	// set to true if a tunnel/reverse-proxy runs in front of this service
	behindTunnel : false,

	// proxy domain like 'your.proxy.domain'
	domain : 'localhost',

	// proxy listening port, if Port Forwarding, it's Internal Port.
	port : 3128,

	// proxy access port, if Port Forwarding, it's External Port
	// set to 443 if https is true
	proxyport : 3128,

	// proxy public ip, use when a vps has multiple public ips but only use one ip
	proxyip : '0.0.0.0',	

	// you will share your pacurl as: https://your.proxy.domain/paclink , please change it to a long random '/xxxxxxxx'
	// if behindtunnel is true paclink will not work as pacurl
	paclink : '/0000000000000000',

	// how long this IP can access proxy since last visit（relaunch browser to reauthorize access)
	// if set to 0 above paclink will not work as pacurl
	iphours : 2,

	// a special paclink with username/password, format is:['paclink', 'username', 'password'], browser will prompt to input proxy username/password
	// iphours do not apply to pacpass,  need to input correct user/pass in 2 minutes, or you need to relaunch browser
	pacpass : [],  // ['/1111111111111111', 'proxyuser', 'proxypass'],

	// content of https://www.proxy.domain, style is: https://blog.ddns.com/homepage.htm. no local site for safety reason
	website :  '',

	// need to "npm install ws", it will create a inner proxy server to handle websocket traffic	
	websocket : false,

	// if false proxy will create a http(s) server	
	skipServer : false,

	// web request handler for not proxy traffic, enable if website value is empty, by default return 403 error
	onrequest : (req, res) => {response(res,403);},

	// websocket handler for not proxy traffic, enable if websocket enabled
	onconnection : (ws, req) => { ws.close(1011, "authentication failed");},

	// ssl cert dir
	certdir : '',

	// ssl cert file, default is {certdir}/{domain}/fullchain.pem
	cert : '',

	// ssl key file, default is {certdir}/{domain}/privkey.pem
	key : ''
};

/**
 * Dependencies
 */
const http = require('http');
const https = require('https');
const net = require('net');
const event = require('events');
const fs = require('fs');

global.Buffer = global.Buffer || require('buffer').Buffer;

if (typeof btoa === 'undefined') {
  global.btoa = function (str) {
    return Buffer.from(str, 'binary').toString('base64');
  };
}

if (typeof atob === 'undefined') {
  global.atob = function (b64Encoded) {
    return Buffer.from(b64Encoded, 'base64').toString('binary');
  };
}
/**
 * Constants
 */
const iosBrowser = { 'firefox' : ' FxiOS', 'chrome' : ' CriOS', 'edge' : ' EdgiOS' } ;
const normalBrowser = { 'firefox' : ' Firefox', 'chrome' : ' Chrome', 'edge' : ' Edg', 'opera' : ' OPR' } ;
const pacDirect = 'function FindProxyForURL(url, host) { return "DIRECT";}';

/**
 * Shared Variables
 */
this.configs = false;
this.server = false;
this.httpAgents = new Map();
this.websiteAgent =  newAgent();
this.websiteParsed = false;
this.proxyClients = new Map();
this.proxyUsers = new Map();
this.proxyAgents = new Map();
this.ipMilliSeconds = 0;
this.innerServer = false;
this.tlsServer = false;
this.proxyAuth = false;
this.WebSocket = false;
const pacProxy = this;

/**
 * Export Module functions
 */
exports.proxy = proxy;
exports.handleRequest = handleRequest;    //use it like: server.on('request', pacproxy.handlerRequest)
exports.handleRequestBehindTunnel = handleRequestBehindTunnel;    //use it like: server.on('request', pacproxy.handleRequestBehindTunnel)
exports.merge = merge;
exports.run = run;
exports.startServer = startServer;

function proxy(configs) {
	if(!configs) configs = configsInCode;
	else merge(configs, configsInCode);

	pacProxy.configs = configs;
	pacProxy.ipMilliSeconds = pacProxy.configs.iphours * 3600 * 1000;
	if(pacProxy.configs.website) pacProxy.websiteParsed = new URL(pacProxy.configs.website);
	if(pacProxy.websiteParsed.host && isLocalHost(pacProxy.websiteParsed.host)) pacProxy.configs.website = false;
	else if(pacProxy.websiteParsed.protocol && (pacProxy.websiteParsed.protocol=='https:')) pacProxy.websiteAgent = newAgent(true);
	
	if(!pacProxy.configs.paclink.startsWith('/')) pacProxy.configs.paclink = '/' + pacProxy.configs.paclink;

	if(pacProxy.configs.pacpass.length==3) pacProxy.proxyAuth = generateBasicAuth(pacProxy.configs.pacpass[1],pacProxy.configs.pacpass[2]);

	event.EventEmitter.prototype._maxListeners = 500;
	event.defaultMaxListeners = 500;

	if(configs.skipServer) return;

	return startServer();
}


function bindServer(server) {

	if(pacProxy.configs.behindTunnel){
		server.on('connect', handleConnectBehindTunnel);
		server.on('request', handleRequestBehindTunnel);
	} else {
		server.on('connect', handleConnect);
		server.on('request', handleRequest);
	}
	server.listen(pacProxy.configs.port, pacProxy.configs.proxyip, () => {
		console.log(
			'\r\npac proxy server listening on port %d,\r\nshare your pac url:  \r\n%s',
			server.address().port, getShareLink('http')
		);

		if(pacProxy.configs.pacpass.length!==3) return;
		console.log(
			'\r\nshare your pac url with username/password: \r\n%s     %s / %s\r\n',
			getShareLink('http', pacProxy.configs.pacpass[0]), pacProxy.configs.pacpass[1], pacProxy.configs.pacpass[2]
		);
	});
	server.on("error", err=>console.log(err));
}


function startServer() {

	server = createServer();
	bindServer(server);
	pacProxy.server = server;

	if(pacProxy.configs.websocket) initInnerServer();
	return server;

}

function generateBasicAuth(user, password) {
    var token = user + ":" + password;
    var hash = btoa(token); 
    return "Basic " + hash;
}

function newAgent(ssl = false) {
	if(ssl) return new https.Agent({keepAlive: true, timeout: 300000, maxCachedSessions: 200 });
	else return new http.Agent({ keepAlive: true, timeout: 300000});
}

function merge(vmain, vdefault){
	Object.entries(vdefault).forEach((value, key) => {
		if(!(value[0] in vmain)) vmain[value[0]] = value[1];
	} ) ;
}

function initInnerServer() {
	pacProxy.innerServer = http.createServer();
	pacProxy.innerServer.on('connect', _handleConnect);
	pacProxy.innerServer.on('request', _handleRequest);
	pacProxy.innerServer.listen(0, '127.0.0.1', () => {
		pacProxy.configs.innerport = pacProxy.innerServer.address().port; 
		console.log('\r\npac proxy server listening on port %d,\r\nshare your wss url:  \r\n%s\r\n',
		pacProxy.configs.innerport, getShareLink('ws'));
		pacProxy.WebSocket = require("ws");
		var ws = new pacProxy.WebSocket.Server({ server: pacProxy.server });
		ws.on("connection", handleWebsocket);
	});

	if(!pacProxy.configs.https) return;
	
	pacProxy.tlsServer = createServer();
	pacProxy.tlsServer.on('connect', _handleConnect);
	pacProxy.tlsServer.on('request', _handleRequest);
	pacProxy.tlsServer.listen(0, '127.0.0.1', ()=>{
		pacProxy.configs.tlsport = pacProxy.tlsServer.address().port;
		console.log('\r\npac proxy server listening on port %d,\r\nshare your wss+tls url:  \r\n%s\r\n',
		pacProxy.configs.tlsport, getShareLink('ws')+'/tls');
	});

	pacProxy.pacServer = createServer();
	pacProxy.pacServer.on('connect', handleConnectBehindTunnel);
	pacProxy.pacServer.on('request', handleRequestBehindTunnel);
	pacProxy.pacServer.listen(0, '127.0.0.1', ()=>{
		pacProxy.configs.pacport = pacProxy.pacServer.address().port;
		console.log('\r\npac proxy server listening on port %d,\r\nshare your wss+pac url:  \r\n%s\r\n',
		pacProxy.configs.pacport, getShareLink('ws')+'/pac');
	});

}

function gErrorHandler(e) {
	log('General Error %s ',  e.message);
}
/**
 * Start Server if configured
 */

// uncomment to run
if(process.argv[1].includes(__filename)) run();

function run() {
    var configs = getConfigs();
	proxy(configs);
}

function getConfigs(){

	if(!process.argv[2]){ 
		if(process.env.PORT) configsInCode.port = process.env.PORT;
		return configsInCode;
	}

	if(!isNaN(process.argv[2])){
		configsInCode.port = process.argv[2];
		return configsInCode;
	}

	let configPath = path.resolve(process.cwd(), process.argv[2]);
	let configs = require(configPath);

	if(!process.argv[3]) return configs;

	configs.port = process.argv[3]; 
	return configs;
}

function createServer() {
	if(!pacProxy.configs.https) return http.createServer();

	if(pacProxy.configs.cert && pacProxy.configs.key){
		let cert1 = fs.readFileSync(pacProxy.configs.cert);
		let key1 = fs.readFileSync(pacProxy.configs.key);
		return https.createServer({key: key1, cert: cert1});
	}

	var certDir = pacProxy.configs.certdir || process.env.CERTDIR || process.cwd()

	let domain = pacProxy.configs.domain;
	var options = {
	  key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
	  cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
	};
	
	return https.createServer(options);
}

function getShareLink(protocal, vlink) {
	let linkDomain = protocal + (pacProxy.configs.https? 's://' : '://') + pacProxy.configs.domain;
	let linkHost = ':' + pacProxy.configs.proxyport;
	if(pacProxy.configs.https && (pacProxy.configs.proxyport == 443)) linkHost = ''; 
	if(!pacProxy.configs.https && (pacProxy.configs.proxyport == 80)) linkHost = '';
	if(!vlink) vlink = pacProxy.configs.paclink;
	return linkDomain + linkHost + vlink;
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

function pacContent(userAgent, vbrowser) {
	log('%s PAC %s ', vbrowser, userAgent);
	if(vbrowser){
		let mbrowser = vbrowser.trim().toLowerCase();
		if(mbrowser in normalBrowser){
			if(!userAgent) return pacDirect;
			else if(!userAgent.includes(normalBrowser[mbrowser])) return pacDirect;
			else if(mbrowser=='chrome'){
				if(userAgent.includes(normalBrowser['edge'])) return pacDirect;
				if(userAgent.includes(normalBrowser['opera'])) return pacDirect;
			}
		} else if(!userAgent.includes(vbrowser)){
			return pacDirect;
		}
	}

	let proxyType = pacProxy.configs.https ? 'HTTPS' : 'PROXY' ;
	let vdomain = pacProxy.configs.domain=='localhost' ? '127.0.0.1' : pacProxy.configs.domain ;
	let pacjs = `function FindProxyForURL(url, host) { return "${proxyType} ${vdomain}:${pacProxy.configs.proxyport}";}`;
	return pacjs;
}

function isLocalHost(host) {
	if(!host) return true;
	let domain = (host.split(':')[0]).trim();
	if(domain.includes('localhost') || domain.includes('.local')) return true;
	return isLocalIP(domain);
}

function isLocalIP(address) {
	if(!address) return true;
	if(address.startsWith('::ffff:') || address.startsWith('::FFFF:')) address = address.slice(7);
	if(address.startsWith('::') || address.startsWith('0')) return true;
	if(address.startsWith('fc') || address.startsWith('fe')) return true;
	if(address.startsWith('192.168.') || address.startsWith('10.') || address.startsWith('127.') || address.startsWith('169.254.') || address.startsWith('172.16')) return true;
	return false;
}

function authenticateIP(req) {
	if(basicAuthentication(req)) return true;

	var checkIP = req.socket.remoteAddress;
	if(pacProxy.proxyUsers.has(checkIP)){
		let [pacPassTime, userAgent] = pacProxy.proxyUsers.get(checkIP);
		if(Date.now()>pacPassTime) pacProxy.proxyUsers.delete(checkIP);
		else if(req.headers['user-agent']==userAgent) return 407
	}

	if(pacProxy.configs.iphours==0) return false;
	if(!pacProxy.proxyClients.has(checkIP)) return false;
	if (pacProxy.proxyClients.get(checkIP) >= Date.now()){	
		pacProxy.proxyClients.set(checkIP, Date.now() + pacProxy.ipMilliSeconds );
		return true;
	} else {
		pacProxy.proxyClients.delete(checkIP);
		return false;
	}
}

function authenticateNoIP(req) {
	if(basicAuthentication(req)) return true;
	var userAgent = req.headers['user-agent'];
	if(pacProxy.proxyAgents.has(userAgent)){
		let pacPassTime = pacProxy.proxyAgents.get(userAgent);
		if(Date.now()>pacPassTime) pacProxy.proxyAgents.delete(userAgent);
		else return 407;
	}
	return false;
}

function basicAuthentication(request) {
	if(pacProxy.configs.pacpass.length!==3) return false;
	if(!pacProxy.proxyAuth) return false;
	let Authorization = request.headers['proxy-authorization'];
	if(!Authorization) return false;
	if (pacProxy.proxyAuth==Authorization) return true;

	return false;
}

function response(res, httpCode, headers, content) {
	res.on('error', gErrorHandler);

	if(headers) res.writeHead(httpCode, headers);
	else res.writeHead(httpCode);

	if(content) res.write(content);
	res.end();
}

function socketResponse(socket, content, cb) {
	if(socket.destroyed) return;
	if(!cb) cb = () => socket.end();
    try {
        socket.write(content+ '\r\n', 'UTF-8', cb);
    } catch (error) {
        cb(error);
    }
}

function requestRemote(parsed, req, res) {

	log('%s Fetch %s ', visitorIP, parsed.toString());
	let agent = http;
	if(parsed.protocol == 'https:') agent = https;

	if(pacProxy.configs.proxyip != '0.0.0.0'){
		parsed.localAddress = pacProxy.configs.proxyip;
	}

	req.on('error', ()=>req.socket.end());
	res.on('error', ()=>req.socket.end());

	let gotResponse = false;
	proxyReq = agent.request(parsed, function(proxyRes) {
		if(isLocalIP(proxyRes.socket.remoteAddress)) return response(res,403);

		res.on('error', ()=>proxyRes.socket.end());
		proxyRes.on('error', ()=>req.socket.end());

		if (gotResponse) return;
		gotResponse = true;
		let headers = filterHeader(proxyRes.headers);

		let statusCode = proxyRes.statusCode ? proxyRes.statusCode : 200;
		res.writeHead(statusCode, headers);

		proxyRes.pipe(res);
	});
	
	proxyReq.on('error',  (err) => {
		log('%s REQUEST %s ', visitorIP, err);
		if (gotResponse) {}
		else if ('ENOTFOUND' == err.code) response(res,400);
		else response(res,500);
		gotResponse = true;
		req.socket.end();
	});

	req.on('end', ()=>proxyReq.end());
	if(!req.writableEnded) req.pipe(proxyReq);
	else proxyReq.end();	
}


/**
 * check if request is from stunnel (or similar ssl tunnel)
 */
function fromStunnel(host) {
	if(!pacProxy.configs.https) return false;
	if(!pacProxy.configs.domain=="localhost") return false;
	if(!host) return false;
	if(!host.split(':')[1]) return false;
	if(host.split(':')[1] == pacProxy.configs.port) return false;
	if(host.startsWith('127.0.0.1') || host.startsWith('localhost')){
		return true;
	} else return false;
}


/**
 * handle website requests
 */
function handleWebsite(req, res, tunnelRequest=false) {
    try {
		visitorIP = req.socket.remoteAddress;
		log('%s %s %s ', visitorIP, req.headers.host, req.url);

		try{
			parsed = new URL('https://'+pacProxy.configs.domain + req.url);
		} catch (e) {
			return  response(res, 403);
		}

		if ((!pacProxy.configs.behindTunnel) && (pacProxy.configs.iphours>0) && pacProxy.configs.paclink && req.url.startsWith(pacProxy.configs.paclink)) {
			let vpac = pacContent(req.headers['user-agent'], req.url.slice(pacProxy.configs.paclink.length+1));
			if(vpac==pacDirect) return response(res,200,{'Content-Type': 'text/plain'},vpac);
			if(!tunnelRequest) pacProxy.proxyClients.set(visitorIP,Date.now()+pacProxy.ipMilliSeconds)

			if(fromStunnel(parsed.host)){
				let pacjs = `function FindProxyForURL(url, host) { return "PROXY ${req.headers.host}";}`;
				return response(res,200,{'Content-Type': 'text/plain'}, pacjs);
			}

			return response(res,200,{'Content-Type': 'text/plain'},vpac);
		}

		if ((pacProxy.configs.pacpass.length==3) && req.url.startsWith(pacProxy.configs.pacpass[0])) {
			let vpac = pacContent(req.headers['user-agent'], req.url.slice(pacProxy.configs.pacpass[0].length+1));
			if(vpac==pacDirect) return response(res,200,{'Content-Type': 'text/plain'},vpac);

			if(!pacProxy.configs.behindTunnel) pacProxy.proxyUsers.set(visitorIP,[Date.now()+120000, req.headers['user-agent']]);
			if(tunnelRequest && req.headers['user-agent']) pacProxy.proxyAgents.set(req.headers['user-agent'], Date.now()+120000);

			if(fromStunnel(parsed.host)){
				let pacjs = `function FindProxyForURL(url, host) { return "PROXY ${req.headers.host}";}`;
				return response(res,200,{'Content-Type': 'text/plain'}, pacjs);
			}
			
			return response(res,200,{'Content-Type': 'text/plain'},vpac);
		}

		if(!pacProxy.configs.website) return pacProxy.configs.onrequest(req, res);

		var headers = filterHeader(req.headers);
		if (parsed.pathname == '/') parsed.pathname = pacProxy.websiteParsed.pathname;
		parsed.protocol = pacProxy.websiteParsed.protocol;
		parsed.host = pacProxy.websiteParsed.host;
		headers.host = pacProxy.websiteParsed.host;
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
	let auth = authenticateIP(req);
	if(!auth) return  response(res, 403);
	if(auth==407) return response(res,407,{'Proxy-Authenticate': 'Basic realm="proxy"'});
	_handleRequest(req, res);
}


function handleRequestBehindTunnel(req, res) {
	if(req.url.startsWith('/')) return handleWebsite(req, res, true);
	let auth = authenticateNoIP(req);
	if(!auth) return  response(res, 403);
	if(auth==407) return response(res,407,{'Proxy-Authenticate': 'Basic realm="proxy"'});
	_handleRequest(req, res);
}

function _handleRequest(req, res) {
	visitorIP = req.socket.remoteAddress;	
	log('%s %s %s ', visitorIP, req.method, req.url);
	if((visitorIP=='127.0.0.1') && req.headers.host.startsWith('localhost') && req.url.startsWith('/pac')) {
		let vpac = pacContent(req.headers['user-agent'], req.url.slice(5));
		if(vpac==pacDirect) return response(res,200,{'Content-Type': 'text/plain'},vpac);
		let pacjs = `function FindProxyForURL(url, host) { return "PROXY ${req.headers.host}";}`;
		return response(res,200,{'Content-Type': 'text/plain'}, pacjs);
	}

	try {
		var parsed = new URL(req.url);
	} catch (e) {
		return  response(res, 403);
	}

	if(isLocalHost(parsed.host)) return response(res, 403);

	var headers = filterHeader(req.headers);

	parsed.method = req.method;
	parsed.headers = headers;

	// use keep-alive http agents
	let host = parsed.host;
	let agent = pacProxy.httpAgents.get(host);
	if (!agent) {
		agent =  newAgent();
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
	socket.on('error', gErrorHandler);
	let auth = authenticateIP(req);
	if(!auth)  return socketResponse(socket,  'HTTP/1.1 403 Forbidden\r\n');
	if(auth == 407 ) return socketResponse(socket, 'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="proxy"\r\n');
	_handleConnect(req, socket);
}


function handleConnectBehindTunnel(req, socket) {
	socket.on('error', gErrorHandler);
	let auth = authenticateNoIP(req);
	if(!auth)  return socketResponse(socket,  'HTTP/1.1 403 Forbidden\r\n');
	if(auth == 407 ) return socketResponse(socket, 'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="proxy"\r\n');
	_handleConnect(req, socket);
}

function _handleConnect(req, socket) {
	if(isLocalHost(req.url)) return socketResponse(socket, 'HTTP/1.1 403 Forbidden\r\n');
    try {
		visitorIP = req.socket.remoteAddress;
		log('%s %s %s ', visitorIP, req.method, req.url);

		var gotResponse = false;

		ontunnelerror = (err) => {
			if (gotResponse) return socket.end();
			if ('ENOTFOUND' == err.code) return socketResponse(socket, 'HTTP/1.1 404 Not Found\r\n');
			else  return socketResponse(socket, 'HTTP/1.1 500 Internal Server Error\r\n');
		}

		let vhost = req.url.split(':')[0];
		let vport = req.url.split(':')[1] || 443;

		var ropts = {
            host: vhost,
            port: vport,
			keepAlive: true
        };

		if(pacProxy.configs.proxyip != '0.0.0.0'){
			ropts.localAddress = pacProxy.configs.proxyip;
		}
	
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

		tunnel.on('lookup',(err, addresss) => {
			if(isLocalIP(addresss)){
				log('%s Error %s ', visitorIP, 'visit localIP');
				tunnel.end();
				socket.end();
			}
		});

		tunnel.on('error', ontunnelerror);
		tunnel.on('close', () => socket.end());
		tunnel.setNoDelay(true);
    } catch (e) {
		log('%s Error %s ', visitorIP, e.message);
    }
}

function handleWebsocket(ws, req) {
	if(!req.url.startsWith( pacProxy.configs.paclink)) return pacProxy.configs.onconnection(ws,req);
	let visitorIP = req.socket.remoteAddress;
	let suburl = req.url.slice(pacProxy.configs.paclink.length);
	log('%s %s %s ', visitorIP, 'WSS', suburl);

	if(!suburl) var tolocal = { host: '127.0.0.1', port: pacProxy.configs.innerport, keepAlive: true};
	else if(suburl.toLowerCase() == '/tls')  var tolocal = { host: '127.0.0.1', port: pacProxy.configs.tlsport, keepAlive: true};
	else if(suburl.toLowerCase() == '/pac')  var tolocal = { host: '127.0.0.1', port: pacProxy.configs.pacport, keepAlive: true};
	else return ws.close(1011, "authentication failed");

	let duplex = pacProxy.WebSocket.createWebSocketStream(ws);
	try{
		var tunnel = net.createConnection(tolocal)
		duplex.on('close', () => tunnel.end());
		duplex.on('error', () => tunnel.end());
		tunnel.on('end', () => ws.close(1000));
		tunnel.on('error', () => ws.close(1000));  
		duplex.pipe(tunnel);
		tunnel.pipe(duplex);
	} catch (e) {
		log('%s Error %s ', visitorIP, e.message);
	}
}