'use strict'

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

	// proxy access port, only used to show in the pac url links
	// if Port Forwarding, it's External Port, normally set to 443 if https is true
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
	pacpass : ['/1111111111111111', 'proxyuser', 'proxypass'],

	// content of https://www.proxy.domain, style is: https://blog.ddns.com/homepage.htm. no local site for safety reason
	website :  '',

	// avoid hacker DDOS attack cause proxy IP blocked by major CDN, format is:['account_name', 'username', 'password'], browser will prompt to input username/password， and save to browser ’account_name' account
	website_auth :  '',  //['Protected','webuser','webpass'],

	// web request handler for not proxy traffic, enable if website value is empty, by default return 403 error
	onrequest : (req, res) => {response(res,403);},

	// websocket handler for not proxy traffic, enable if websocket enabled
	onconnection : (ws, req) => { ws.close(1011, "authentication failed");},

	// ssl cert file, if empty it will be: {certdir}/{domain}/fullchain.pem
	cert : '',

	// ssl key file, if empty it will be: {certdir}/{domain}/privkey.pem
	key : '',

	// default ssl cert dir, if empty it will be env argument or current path
	certdir : '',

	// if false proxy will start the proxy server later
	skipStart : false,
	
	// need to "npm install ws", it will create inner proxy servers to handle websocket traffic	
	websocket : false,

	// websocket wss service inner listning port
	wssport : 0,

	// websocket wss+tls service inner listning port
	tlsport : 0,

	// websocket wss+pac service inner listning port
	pacport : 0
};


/**
 * Dependencies
 */
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');

/**
 * Shared Variables
 */
const normalBrowser = { 'firefox' : ' Firefox', 'chrome' : ' Chrome', 'edge' : ' Edg', 'opera' : ' OPR' } ;
const pacDirect = 'function FindProxyForURL(url, host) { return "DIRECT";}';
const pacHeaders = {'Content-Type': 'text/plain', 'Cache-Control': 'no-cache, no-store'};

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
 * Export Module functions
 */
exports.proxy = proxy;
exports.merge = merge;
exports.run = run;
exports.startServer = startServer;


/**
 * Init and start proxy
 */
function proxy(configs) {
	if(!configs) configs = configsInCode;
	else {
		configsInCode.paclink = '';
		configsInCode.pacpass = [];
		merge(configs, configsInCode);
	}
	
	pacProxy.configs = configs;
	pacProxy.ipMilliSeconds = pacProxy.configs.iphours * 3600 * 1000;
	if(pacProxy.configs.website) pacProxy.websiteParsed = new URL(pacProxy.configs.website);
	if(pacProxy.websiteParsed.host && isLocalHost(pacProxy.websiteParsed.host)) pacProxy.configs.website = false;
	else if(pacProxy.websiteParsed.protocol && (pacProxy.websiteParsed.protocol=='https:')) pacProxy.websiteAgent = newAgent(true);
	
	if(pacProxy.configs.paclink && !pacProxy.configs.paclink.startsWith('/')) pacProxy.configs.paclink = '/' + pacProxy.configs.paclink;
	if(pacProxy.configs.pacpass && pacProxy.configs.pacpass[0] && !pacProxy.configs.pacpass[0].startsWith('/')) pacProxy.configs.pacpass[0] = '/' + pacProxy.configs.pacpass[0];

	if(pacProxy.configs.pacpass && pacProxy.configs.pacpass.length==3) pacProxy.proxyAuth = generateBasicAuth(pacProxy.configs.pacpass[1],pacProxy.configs.pacpass[2]);

	if(pacProxy.configs.website_auth && pacProxy.configs.website_auth.length==3) pacProxy.websiteAuth = generateBasicAuth(pacProxy.configs.website_auth[1],pacProxy.configs.website_auth[2]);

	if(configs.skipStart) return;

	return startServer();
}

function startServer() {
	let server = createServer();
	bindServer(server);
	pacProxy.server = server;

	if(pacProxy.configs.websocket && pacProxy.configs.paclink) initInnerServer();
	return server;
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
		console.log('\r\npac proxy server listening on port %d,',server.address().port);
		if(!pacProxy.configs.behindTunnel && pacProxy.configs.paclink)	console.log('\r\nshare your pac url: \r\n%s', getShareLink('http'));

		if(pacProxy.configs.pacpass.length!==3) return;
		console.log(
			'\r\nshare your pac url with username/password: \r\n%s     %s / %s\r\n',
			getShareLink('http', pacProxy.configs.pacpass[0]), pacProxy.configs.pacpass[1], pacProxy.configs.pacpass[2]
		);
	});
	server.on("error", err=>console.log(err));
}

function initInnerServer() {
	pacProxy.innerServer = http.createServer();
	pacProxy.innerServer.on('connect', _handleConnect);
	pacProxy.innerServer.on('request', _handleRequest);
	pacProxy.innerServer.listen(pacProxy.configs.wssport, '127.0.0.1', () => {
		pacProxy.configs.wssport = pacProxy.innerServer.address().port; 
		console.log('\r\npac proxy server listening on port %d,\r\nshare your wss url:  \r\n%s\r\n',
		pacProxy.configs.wssport, getShareLink('ws'));
		pacProxy.WebSocket = require("ws");
		var ws = new pacProxy.WebSocket.Server({ server: pacProxy.server });
		ws.on("connection", handleWebsocket);
	});
	pacProxy.innerServer.on('error', gErrorHandler);

	if(!pacProxy.configs.https) return;
	
	pacProxy.tlsServer = createServer();
	pacProxy.tlsServer.on('connect', _handleConnect);
	pacProxy.tlsServer.on('request', _handleRequest);
	pacProxy.tlsServer.listen(pacProxy.configs.tlsport, '127.0.0.1', ()=>{
		pacProxy.configs.tlsport = pacProxy.tlsServer.address().port;
		console.log('\r\npac proxy server listening on port %d,\r\nshare your wss+tls url:  \r\n%s\r\n',
		pacProxy.configs.tlsport, getShareLink('ws')+'/tls');
	});
	pacProxy.tlsServer.on('error', gErrorHandler);

	pacProxy.pacServer = createServer();
	pacProxy.pacServer.on('connect', handleConnectBehindTunnel);
	pacProxy.pacServer.on('request', handleRequestBehindTunnel);
	pacProxy.pacServer.listen(pacProxy.configs.pacport, '127.0.0.1', ()=>{
		pacProxy.configs.pacport = pacProxy.pacServer.address().port;
		console.log('\r\npac proxy server listening on port %d,\r\nshare your wss+pac url:  \r\n%s\r\n',
		pacProxy.configs.pacport, getShareLink('ws')+'/pac');
	});
	pacProxy.pacServer.on('error', gErrorHandler);
}

function run() {
	var configs = getConfigs();
	proxy(configs);
}

function getConfigs(){
	if(!process.argv[2]){ 
		if(process.env.PORT) configsInCode.port = process.env.PORT;
		return false;
	}

	if(!isNaN(process.argv[2])){
		configsInCode.port = process.argv[2];
		return false;
	}

	let configPath = path.resolve(process.cwd(), process.argv[2]);
	let configs = require(configPath);

	if(!process.argv[3]) return configs;

	configs.port = process.argv[3]; 
	return configs;
}

function createServer() {
	if(!pacProxy.configs.https) return http.createServer();
	if(pacProxy.configs.behindTunnel && (!pacProxy.configs.cert) && (!pacProxy.configs.key) && (!pacProxy.configs.certdir) ) return http.createServer();

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


/**
 * shared functions
 */

function gErrorHandler(e) {
	log('General Error %s ',  e.message);
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

function getShareLink(protocal, vlink) {
	let linkDomain = protocal + (pacProxy.configs.https? 's://' : '://') + pacProxy.configs.domain;
	let linkHost = ':' + pacProxy.configs.proxyport;
	if(pacProxy.configs.https && (pacProxy.configs.proxyport == 443)) linkHost = ''; 
	if(!pacProxy.configs.https && (pacProxy.configs.proxyport == 80)) linkHost = '';
	if(!vlink) vlink = pacProxy.configs.paclink;
	return linkDomain + linkHost + vlink;
}

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

function pacContent(req, vbrowser) {
	let userAgent = req.headers['user-agent'];
	log('%s PAC %s ', vbrowser, userAgent);
	if(!req.headers["host"]){ return pacDirect;}
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

	let [vdomain, vport] = req.headers["host"].split(':');
	if(!vport){ vport = pacProxy.configs.https? 443 : 80}
	let proxyType = pacProxy.configs.https ? 'HTTPS' : 'PROXY' ;
	let pacjs = `function FindProxyForURL(url, host) { return "${proxyType} ${vdomain}:${vport}";}`;
	return pacjs;
}

function isLocalHost(host) {
	if(!host) return true;
	const domain = (host.split(':')[0]).trim().toLowerCase();
	if(domain.includes('localhost') || domain.includes('.local')) return true;
	return isLocalIP(domain);
}

function isLocalIP(address) {
	if(!address) return true;
	address = address.toLowerCase();
	if(address.startsWith('::ffff:')) address = address.slice(7);
	if(address.startsWith('::') || address.startsWith('0')) return true;
	if(address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe')) return true;
	if(address.startsWith('192.168.') || address.startsWith('10.') || address.startsWith('127.') || address.startsWith('169.254.') || address.startsWith('172.16')) return true;
	return false;
}

function authenticateIP(req) {
	if(basicAuthentication(req)) return true;

	const checkIP = req.socket.remoteAddress;
	if(pacProxy.proxyUsers.has(checkIP)){
		const [pacPassTime, userAgent] = pacProxy.proxyUsers.get(checkIP);
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
	const userAgent = req.headers['user-agent'];
	if(pacProxy.proxyAgents.has(userAgent)){
		const pacPassTime = pacProxy.proxyAgents.get(userAgent);
		if(Date.now()>pacPassTime) pacProxy.proxyAgents.delete(userAgent);
		else return 407;
	}
	return false;
}

function basicAuthentication(request) {
	if(pacProxy.configs.pacpass.length!==3) return false;
	if(!pacProxy.proxyAuth) return false;
	const Authorization = request.headers['proxy-authorization'];
	if(!Authorization) return false;
	if (pacProxy.proxyAuth==Authorization) return true;

	return false;
}

function websiteAuthentication(request) {
	if(!pacProxy.configs.website_auth) return true;
	if(pacProxy.configs.website_auth.length!==3) return false;
	if(!pacProxy.websiteAuth) return false;
	const Authorization = request.headers['authorization'];
	if(!Authorization) return false;
	if (pacProxy.websiteAuth==Authorization) return true;
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
	socket.write(content+ '\r\n', 'UTF-8', cb);
}

function requestRemote(parsed, req, res) {
	const visitorIP = req.socket.remoteAddress;
	log('%s Fetch %s ', visitorIP, parsed.toString());
	let agent = http;
	if(parsed.protocol == 'https:') agent = https;

	if(pacProxy.configs.proxyip != '0.0.0.0'){
		parsed.localAddress = pacProxy.configs.proxyip;
	}

	var gotResponse = false;
	var proxyReq = agent.request(parsed, function(proxyRes) {
		if(isLocalIP(proxyRes.socket.remoteAddress)) return response(res,403);
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


	const endRequest = ()=>{
		proxyReq.end();
		res.removeListener('finish', endRequest);
		req.removeListener('end', endRequest);		
	}
	res.on('finish', ()=>endRequest());
	req.on('end', ()=>endRequest());
	
	if(!req.writableEnded) req.pipe(proxyReq);
	else endRequest();	
}

/**
 * handle website requests
 */
function handleWebsite(req, res, tunnelRequest=false) {
	const visitorIP = req.socket.remoteAddress;
	log('%s %s %s ', visitorIP, req.headers.host, req.url);

	if ((!tunnelRequest) && (pacProxy.configs.iphours>0) && pacProxy.configs.paclink && req.url.startsWith(pacProxy.configs.paclink)) {
		const vpac = pacContent(req, req.url.slice(pacProxy.configs.paclink.length+1));
		if(vpac==pacDirect) return response(res,200,pacHeaders,vpac);
		pacProxy.proxyClients.set(visitorIP,Date.now()+pacProxy.ipMilliSeconds)
		return response(res,200,pacHeaders,vpac);
	}

	if ((pacProxy.configs.pacpass.length==3) && req.url.startsWith(pacProxy.configs.pacpass[0])) {
		const vpac = pacContent(req, req.url.slice(pacProxy.configs.pacpass[0].length+1));
		if(vpac==pacDirect) return response(res,200,pacHeaders,vpac);

		if(!tunnelRequest) pacProxy.proxyUsers.set(visitorIP,[Date.now()+120000, req.headers['user-agent']]);
		else if(req.headers['user-agent']) pacProxy.proxyAgents.set(req.headers['user-agent'], Date.now()+120000);

		return response(res,200,pacHeaders,vpac);
	}

	if(!websiteAuthentication(req)) return response(res,401,{'WWW-Authenticate': 'Basic realm="' + pacProxy.configs.website_auth[0] + '"'});

	if(!pacProxy.configs.website) return pacProxy.configs.onrequest(req, res);

	try{
		var parsed = new URL('https://'+pacProxy.configs.domain + req.url);
	} catch (e) {
		return  response(res, 403);
	}

	const headers = filterHeader(req.headers);
	if (parsed.pathname == '/') parsed.pathname = pacProxy.websiteParsed.pathname;
	parsed.protocol = pacProxy.websiteParsed.protocol;
	parsed.host = pacProxy.websiteParsed.host;
	headers.host = pacProxy.websiteParsed.host;
	parsed.port = pacProxy.websiteParsed.port;
	parsed.method = req.method;
	parsed.headers = headers;
	parsed.agent = pacProxy.websiteAgent;

	try {
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
	const auth = authenticateIP(req);
	if(!auth) return  response(res, 403);
	if(auth==407) return response(res,407,{'Proxy-Authenticate': 'Basic realm="proxy"'});
	_handleRequest(req, res);
}


function handleRequestBehindTunnel(req, res) {
	if(req.url.startsWith('/')) return handleWebsite(req, res, true);
	const auth = authenticateNoIP(req);
	if(!auth) return  response(res, 403);
	if(auth==407) return response(res,407,{'Proxy-Authenticate': 'Basic realm="proxy"'});
	_handleRequest(req, res);
}

function _handleRequest(req, res) {
	const visitorIP = req.socket.remoteAddress;	
	log('%s %s %s ', visitorIP, req.method, req.url);
	if((visitorIP=='127.0.0.1') && req.headers.host.startsWith('localhost') && req.url.startsWith('/pac')) {
		const vpac = pacContent(req, req.url.slice(5));
		if(vpac==pacDirect) return response(res,200,pacHeaders,vpac);
		const pacjs = `function FindProxyForURL(url, host) { return "PROXY ${req.headers.host}";}`;
		return response(res,200,pacHeaders,pacjs);
	}

	try {
		var parsed = new URL(req.url);
	} catch (e) {
		return  response(res, 403);
	}

	if(isLocalHost(parsed.host)) return response(res, 403);

	const headers = filterHeader(req.headers);

	parsed.method = req.method;
	parsed.headers = headers;

	// use keep-alive http agents
	const host = parsed.host;
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
 * handle proxy CONNECT requests.
 */

function handleConnect(req, socket) {
	socket.on('error', gErrorHandler);
	const auth = authenticateIP(req);
	if(!auth)  return socketResponse(socket,  'HTTP/1.1 403 Forbidden\r\n');
	if(auth == 407 ) return socketResponse(socket, 'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="proxy"\r\n');
	_handleConnect(req, socket);
}


function handleConnectBehindTunnel(req, socket) {
	socket.on('error', gErrorHandler);
	const auth = authenticateNoIP(req);
	if(!auth)  return socketResponse(socket,  'HTTP/1.1 403 Forbidden\r\n');
	if(auth == 407 ) return socketResponse(socket, 'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="proxy"\r\n');
	_handleConnect(req, socket);
}

function _handleConnect(req, socket) {
	if(isLocalHost(req.url)) return socketResponse(socket, 'HTTP/1.1 403 Forbidden\r\n');
	const visitorIP = req.socket.remoteAddress;
	log('%s %s %s ', visitorIP, req.method, req.url);

	var gotResponse = false;

	const ontunnelerror = (err) => {
		if (gotResponse) return socket.end();
		if ('ENOTFOUND' == err.code) return socketResponse(socket, 'HTTP/1.1 404 Not Found\r\n');
		else  return socketResponse(socket, 'HTTP/1.1 500 Internal Server Error\r\n');
	}

	const vhost = req.url.split(':')[0];
	const vport = req.url.split(':')[1] || 443;

	const ropts = {
		host: vhost,
		port: vport,
		keepAlive: true
	};

	if(pacProxy.configs.proxyip != '0.0.0.0'){
		ropts.localAddress = pacProxy.configs.proxyip;
	}

	const transfer = (error) =>  {
		try{
			gotResponse = true;
			if (error) {
				tunnel.destroy();
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
			gotResponse = true;
			tunnel.destroy();
			socket.end();
		}
	});

	tunnel.on('error', ontunnelerror);
	tunnel.on('end', () => socket.end());
	socket.on('end', () => tunnel.destroy())
	tunnel.setNoDelay(true);
}

/**
 * handle proxy websocket requests.
 */

function handleWebsocket(ws, req) {
	if(!pacProxy.configs.paclink) return pacProxy.configs.onconnection(ws,req);
	if(!req.url.startsWith( pacProxy.configs.paclink)) return pacProxy.configs.onconnection(ws,req);
	const visitorIP = req.socket.remoteAddress;
	const suburl = req.url.slice(pacProxy.configs.paclink.length);
	log('%s %s %s ', visitorIP, 'WSS', suburl);

	if(!suburl) var tolocal = { host: '127.0.0.1', port: pacProxy.configs.wssport, keepAlive: true};
	else if(suburl.toLowerCase() == '/tls')  var tolocal = { host: '127.0.0.1', port: pacProxy.configs.tlsport, keepAlive: true};
	else if(suburl.toLowerCase() == '/pac')  var tolocal = { host: '127.0.0.1', port: pacProxy.configs.pacport, keepAlive: true};
	else return ws.close(1011, "authentication failed");

	const duplex = pacProxy.WebSocket.createWebSocketStream(ws);
	try{
		const tunnel = net.createConnection(tolocal)
		duplex.on('close', () => tunnel.destroy());
		duplex.on('error', () => tunnel.destroy());
		tunnel.on('end', () => {duplex.destroy(); ws.close(1000)});
		tunnel.on('error', () => {duplex.destroy(); ws.close(1000)}); 
		duplex.pipe(tunnel);
		tunnel.pipe(duplex);
	} catch (e) {
		log('%s Error %s ', visitorIP, e.message);
	}
}

process.on('uncaughtException', gErrorHandler)
