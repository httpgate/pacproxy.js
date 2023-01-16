#!/usr/bin/env node

//sample configs, change it to your settings
const configsInCode = {
	// set to false to save storage and avoid problems
	logging : true,
	// run as https server, or as http server inside ssl tunnel (like stunnel)
	https : true,
	// proxy listening port, if Port Forwarding, it's Internal Port
	port : 3128,
	// proxy domain
	domain : 'your.proxy.domain',
	// proxy access port, if Port Forwarding, it's External Port
	proxyport : 443,
	// you will share your pac link as: https://your.proxy.domain/paclink , please change it to a long random '/xxxxxxxx'
	paclink : '/0000000000000000',
	// how long this IP can access proxy since this it visit pac link（launch browser or connect to wifi)
	iphours : 4,
	// content of https://www.proxy.domain, style is: https://blog.ddns.com/homepage.htm. no local site for safety reason
	website :  '',
	// ssl cert file, default is ./{domain}/fullchain.pem
	cert : '',
	// ssl key file, default is ./{domain}/privkey.pem
	key : '',
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
const pacProxy = this;

/**
 * Export Module functions
 */

exports.proxy = proxy;
exports.load = load;
exports.handleRequest = handleRequest;
exports.handleConnect = handleConnect;

function load(configs) {
	if(!configs) configs = configsInCode;
	pacProxy.configs = configs;
	pacProxy.ipMilliSeconds = pacProxy.configs.iphours * 3600 * 1000;
	if(pacProxy.configs.website) pacProxy.websiteParsed = new URL(pacProxy.configs.website);
	if(pacProxy.websiteParsed.host && isLocalHost(pacProxy.websiteParsed.host)) pacProxy.configs.website = false;

	if(!pacProxy.configs.paclink.startsWith('/')) pacProxy.configs.paclink = '/' + pacProxy.configs.paclink;
	event.EventEmitter.prototype._maxListeners = 500;
	event.defaultMaxListeners = 500;
	return this;
}

function proxy(server, configs) {
	if(configs) load(configs);
	pacProxy.server = server;
	server.on('request', handleRequest);
	server.on('connect', handleConnect);
	return server;
}

/**
 * Start Server if configured
 */

// uncomment to run
run();

function run() {
    var configs = getConfigs();
	load(configs);

	if (!pacProxy.server) var server = createServer();
	proxy(server);

	server.listen(pacProxy.configs.port, function() {
		console.log(
			'pac proxy server listening on port %d,\r\nshare your pac url:\r\n%s',
			this.address().port, getPacLink()
		);
	});
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
	if(process.env.CERTDIR) var certDir = process.env.CERTDIR;

	let domain = pacProxy.configs.domain;
	var options = {
	  key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
	  cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
	};
	
	return https.createServer(options);
}

function getPacLink() {
	linkDomain = 'https://' + pacProxy.configs.domain;
	if(pacProxy.configs.proxyport != 443) linkDomain += ':' + pacProxy.configs.proxyport;
	return linkDomain + pacProxy.configs.paclink;
}
/**
 * Shared Functions
 */
function filterHeader(reqHeaders){
	let resHeaders = reqHeaders;
	if((!reqHeaders) || (!Array.isArray(reqHeaders))) return;
	if ('connection' in resHeaders) delete resHeaders['connection'];
	if ('keep-alive' in resHeaders) delete resHeaders['keep-alive'];
	if ('upgrade' in resHeaders) delete resHeaders['upgrade'];
	return resHeaders;
}

function log(...args) {
	if (pacProxy.configs && pacProxy.configs.logging) console.log(...args);
}

function pacContent() {
	pacjs = 'function FindProxyForURL(url, host) { return "HTTPS ' + pacProxy.configs.domain + ':' + pacProxy.configs.proxyport + '";}';
	return pacjs;
}

function isLocalHost($host) {
	let $domain = trim($host.split(':')[0]);
	if($domain.includes('localhost') || $domain.includes('.local')) return true;
	if($domain.includes('::')) return true;  //ipv6 native ip
	if($domain.startsWith('192.') || $domain.startsWith('10.') || $domain.startsWith('172.') || $domain.startsWith('127.')) return true;
	return false;
}

function authenticate(req, res) {
	var visitorIP = req.socket.remoteAddress;
	lastPacLoad = pacProxy.proxyClients.get(visitorIP);

	if(lastPacLoad && (lastPacLoad + pacProxy.ipMilliSeconds > Date.now())) return true;	
	return false;
}

function response(res, httpCode, headers, content) {
	if(headers) res.writeHead(httpCode, headers);
	else res.writeHead(httpCode);

	if(content) res.write(content);
	res.end();
}

function socketResponse(socket, content, cb) {
	if(!cb){ 
		cb = function(error){
			socket.end();
		}		
	}

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
		if (gotResponse) req.socket.end();
		else if ('ENOTFOUND' == err.code) response(res,400);
		else response(res,500);
		endRequest();
	});

	res.on('close', endRequest);
	req.socket.on('close', endRequest);
	req.socket.on('error', endRequest);

	function endRequest() {
		try{
			proxyReq.end();
			req.socket.removeListener('close', endRequest);
			res.removeListener('finish', endRequest);
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

		if(!pacProxy.configs.website) return response(res, 403);
		log('%s %s %s ', visitorIP, req.headers.host, req.url);
		if(! parsed) parsed = new URL('http://'+pacProxy.configs.domain + req.url);

		var headers = filterHeader(req.headers);
 	    if (! 'host' in headers || headers.host.split(':')[0] != pacProxy.configs.domain)  return response(res, 500);

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
	var parsed = new URL(req.url);
	if(!parsed.host || (parsed.host.split(':')[0] == pacProxy.configs.domain)) return handleWebsite(req, res, parsed);
	if(!authenticate(req, res)) return  response(res, 403);;
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
	if(!authenticate(req, socket)) return socketResponse(res,  'HTTP/1.1 403 Forbidden\r\n');;
	if(isLocalHost(req.url)) return socketResponse(socket, 'HTTP/1.1 403 Forbidden\r\n');

	visitorIP = req.socket.remoteAddress;
	log('%s %s %s ', visitorIP, req.method, req.url);

	var gotResponse = false;

	socket.on('error', function onsocketerror(e) {
		log('%s Error %s ', visitorIP, e.message);
	});

    try {
		function ontunnelerror(err) {
			if (gotResponse) return socket.end();
			if ('ENOTFOUND' == err.code) return socketResponse(socket, 'HTTP/1.1 404 Not Found\r\n');
			else  return socketResponse(socket, 'HTTP/1.1 500 Internal Server Error\r\n');
		}

        var ropts = {
            host: req.url.split(':')[0],
            port: req.url.split(':')[1] || 443
        };

		var tunnel = net.createConnection(ropts, function() {
			gotResponse = true;
			socketResponse(socket,  'HTTP/1.1 200 Connection established\r\n',
				function(error) {
					if (error) {
						try{
							tunnel.end();
							socket.end();
						} catch (e) {
							log('%s Error %s ', visitorIP, e.message);
						}
						return;
					}
					tunnel.pipe(socket);
					socket.pipe(tunnel);
				}
			);
            });

			tunnel.setNoDelay(true);
			tunnel.on('error', ontunnelerror);
			tunnel.on('close', function ontunnelclose() {				
			try{
				socket.end(); 
			} catch (e) {
				log('%s Error %s ', visitorIP, e.message);
			}
		} );	

    } catch (e) {
		log('%s Error %s ', visitorIP, e.message);
    }

}



