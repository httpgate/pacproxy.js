//PM2 default running configs

module.exports = {
  apps : [{
    name   : "pacproxy",
    script : "./runproxy.js",
    //args   : "./example.site.domain/production.cfg 3128",
    watch  : true,
    instances : 1
  }]
}
