const express = require('express')
const httpProxy = require('http-proxy')

const app = express()
const PORT = 8000

const S3_BUCKET = 'newhosting-application'
const S3_REGION = 'ap-south-1'
const S3_BASE_PATH = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/__outputs`

const proxy = httpProxy.createProxy()

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    // Custom Domain - DB Query

    const resolvesTo = `${S3_BASE_PATH}/${subdomain}`

    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })

})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'

})

app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`))
